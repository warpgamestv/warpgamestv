// ============================================================
// CLOUD CONFIG — fill these in after running SUPABASE_SETUP.md
// ============================================================
const SUPABASE_URL      = 'https://athvzdcvaxfevjnagklq.supabase.co'; // e.g. 'https://abcdefg.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_pIYnEtDM5ffc-mqy97QQQQ_4gyI9SaC'; // anon (public) key from Project Settings → API

const isCloudEnabled = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const CLOUD_STATE = { online: false, lastSync: 0, lastError: null, pending: false };

async function supaRequest(method, path, body, extraHeaders = {}) {
    if (!isCloudEnabled()) return null;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=minimal',
        ...extraHeaders
    };
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    if (method === 'GET') return await res.json();
    if (headers.Prefer && headers.Prefer.includes('representation')) {
        const t = await res.text();
        return t ? JSON.parse(t) : null;
    }
    return null;
}

async function cloudUpsertPlayer() {
    if (!isCloudEnabled() || !state?.profile?.playerId) return;
    try {
        await supaRequest('POST', '/players?on_conflict=id', [{
            id: state.profile.playerId,
            name: state.profile.name || 'Wanderer',
            last_seen: new Date().toISOString()
        }]);
        CLOUD_STATE.online = true; CLOUD_STATE.lastError = null;
    } catch (e) {
        CLOUD_STATE.online = false; CLOUD_STATE.lastError = e.message;
        console.warn('[cloud] upsert player failed', e);
    }
}

async function cloudPushSave(saveBlob) {
    if (!isCloudEnabled() || !state?.profile?.playerId || CLOUD_STATE.pending) return;
    CLOUD_STATE.pending = true;
    try {
        await supaRequest('POST', '/saves?on_conflict=player_id', [{
            player_id: state.profile.playerId,
            data: saveBlob,
            updated_at: new Date().toISOString()
        }]);
        CLOUD_STATE.online = true; CLOUD_STATE.lastError = null; CLOUD_STATE.lastSync = Date.now();
    } catch (e) {
        CLOUD_STATE.online = false; CLOUD_STATE.lastError = e.message;
        console.warn('[cloud] push save failed', e);
    } finally {
        CLOUD_STATE.pending = false;
    }
}

async function cloudPullSave() {
    if (!isCloudEnabled() || !state?.profile?.playerId) return null;
    try {
        const rows = await supaRequest('GET', `/saves?player_id=eq.${encodeURIComponent(state.profile.playerId)}&select=data,updated_at`);
        CLOUD_STATE.online = true; CLOUD_STATE.lastError = null;
        return rows && rows[0] ? rows[0] : null;
    } catch (e) {
        CLOUD_STATE.online = false; CLOUD_STATE.lastError = e.message;
        console.warn('[cloud] pull save failed', e);
        return null;
    }
}

async function cloudSubmitScore(mode, seed, score, level) {
    if (!isCloudEnabled() || !state?.profile?.playerId) return;
    try {
        await supaRequest('POST', '/scores?on_conflict=player_id,mode,seed', [{
            player_id: state.profile.playerId,
            name: state.profile.name || 'Wanderer',
            mode, seed: seed || '',
            score: Math.floor(score),
            level: Math.floor(level || 1)
        }]);
        CLOUD_STATE.online = true; CLOUD_STATE.lastError = null;
    } catch (e) {
        CLOUD_STATE.online = false; CLOUD_STATE.lastError = e.message;
        console.warn('[cloud] submit score failed', e);
    }
}

async function cloudFetchLeaderboard(mode, seed, limit = 25) {
    if (!isCloudEnabled()) return null;
    try {
        let path = `/scores?mode=eq.${mode}&order=score.desc&limit=${limit}&select=name,score,level,seed,created_at,player_id`;
        if (seed !== undefined) path += `&seed=eq.${encodeURIComponent(seed)}`;
        return await supaRequest('GET', path);
    } catch (e) {
        CLOUD_STATE.online = false; CLOUD_STATE.lastError = e.message;
        console.warn('[cloud] fetch leaderboard failed', e);
        return null;
    }
}

// Debounced cloud save trigger (called from local saveGame)
let _cloudSaveTimer = null;
function queueCloudSave(saveBlob) {
    if (!isCloudEnabled()) return;
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => cloudPushSave(saveBlob), 1500);
}

// Web Audio API Sound Generation
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let bgmOscillators = [];
let isAudioInitialized = false;
let isBgmPlaying = false;
let masterGain = null;
let bgmGain = null;
let sfxGain = null;
let isWiping = false;
let activeUpgradeTab = 'motes'; // Default tab

function updateVolume() {
    if (!audioCtx) return;

    // Master Gain (attenuation factor)
    const masterBase = (state.settings.masterVolume ?? state.settings.volume ?? 80) / 100;
    if (masterGain) {
        masterGain.gain.setTargetAtTime(masterBase * 0.4, audioCtx.currentTime, 0.1);
    }

    // BGM Gain
    if (bgmGain) {
        const bgmBase = (state.settings.bgmVolume ?? 80) / 100;
        bgmGain.gain.setTargetAtTime(bgmBase, audioCtx.currentTime, 0.1);
    }

    // SFX Gain
    if (sfxGain) {
        const sfxBase = (state.settings.sfxVolume ?? 80) / 100;
        sfxGain.gain.setTargetAtTime(sfxBase, audioCtx.currentTime, 0.1);
    }

    // Sync UI Labels if open
    const mVal = document.getElementById('master-vol-val');
    const bVal = document.getElementById('bgm-vol-val');
    const sVal = document.getElementById('sfx-vol-val');
    if (mVal) mVal.textContent = `${state.settings.masterVolume}%`;
    if (bVal) bVal.textContent = `${state.settings.bgmVolume}%`;
    if (sVal) sVal.textContent = `${state.settings.sfxVolume}%`;
}

function initAudio() {
    if (isAudioInitialized) return;
    if (!AudioContext) {
        console.warn("Web Audio API not supported in this browser");
        return;
    }

    try {
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);

        bgmGain = audioCtx.createGain();
        bgmGain.connect(masterGain);

        sfxGain = audioCtx.createGain();
        sfxGain.connect(masterGain);

        isAudioInitialized = true;
        updateVolume();
        startBGM();
    } catch (e) {
        console.error("Audio initialization failed:", e);
    }
}

function playTone(freq, type, vol, duration, slide = false) {
    if (!isAudioInitialized || !state.settings.volume) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (slide) osc.frequency.exponentialRampToValueAtTime(freq / 2, audioCtx.currentTime + duration);

        const volScale = 0.15; // Baseline attenuation
        gain.gain.setValueAtTime(vol * volScale, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { console.error("Audio error", e); }
}

function playHarvestSound() {
    playTone(600 + Math.random() * 200, 'sine', 0.4, 0.1);
}

function playSellSound() {
    playTone(400 + Math.random() * 100, 'triangle', 0.3, 0.5, true);
}

function playLevelUpSound() {
    setTimeout(() => playTone(440, 'sine', 0.5, 0.5), 0);
    setTimeout(() => playTone(554, 'sine', 0.5, 0.5), 100);
    setTimeout(() => playTone(659, 'sine', 0.8, 0.5), 200);
    setTimeout(() => playTone(880, 'sine', 1.0, 0.6), 300);
}

function startBGM() {
    if (isBgmPlaying) return;
    isBgmPlaying = true;

    const freqs = [110, 164.81, 220]; // A2, E3, A3

    freqs.forEach(freq => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1 + Math.random() * 0.1;

        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.05; // Modulation depth

        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        gain.gain.value = 0.05; // Base drone volume

        osc.connect(gain);
        gain.connect(bgmGain);

        try {
            osc.start();
            lfo.start();
        } catch (e) { }

        bgmOscillators.push(osc);
    });
}
const astralUpgrades = [
    { id: 'astral_attunement', name: 'Astral Attunement', description: '+20% base Mote gain', cost: 1, x: 50, y: 12, req: null, icon: '✨' },
    { id: 'luminous_stride', name: 'Luminous Stride', description: '+15% Move Speed', cost: 2, x: 22, y: 28, req: 'astral_attunement', icon: '👟' },
    { id: 'celestial_pockets', name: 'Celestial Pockets', description: '+50 Max Pods', cost: 2, x: 50, y: 28, req: 'astral_attunement', icon: '🎒' },
    { id: 'tether_mastery', name: 'Tether Mastery', description: 'Tethers 25% faster', cost: 3, x: 78, y: 28, req: 'astral_attunement', icon: '🔗' },
    { id: 'radiant_echo', name: 'Radiant Echo', description: 'Burst triggers twice', cost: 5, x: 22, y: 46, req: 'luminous_stride', icon: '🔊' },
    { id: 'starlight_harvest', name: 'Starlight Harvest', description: 'Trees regrow +20%', cost: 4, x: 78, y: 46, req: 'tether_mastery', icon: '🌟' },
    { id: 'void_shield', name: 'Void Shield', description: 'Resist 1 spirit hit', cost: 6, x: 50, y: 46, req: 'celestial_pockets', icon: '🛡️' },
    // v3.1 Cosmos tier — unlocks after first ascension + all base nodes purchased
    { id: 'cosmic_bloom',  name: 'Cosmic Bloom',  description: '+50% Mote gain (stacks with Attunement)', cost: 10, x: 22, y: 72, req: 'radiant_echo',       icon: '🌌', tier: 'cosmos' },
    { id: 'eternal_stride', name: 'Eternal Stride', description: '+30% Move Speed (stacks with Stride)',  cost: 10, x: 22, y: 90, req: 'cosmic_bloom',       icon: '⚡', tier: 'cosmos' },
    { id: 'phantom_pouch', name: 'Phantom Pouch', description: '+100 Max Pods (stacks with Pockets)',     cost: 12, x: 50, y: 72, req: 'void_shield',        icon: '👻', tier: 'cosmos' },
    { id: 'star_crucible', name: 'Star Crucible', description: 'Tethers harvest +50%',                    cost: 12, x: 78, y: 72, req: 'starlight_harvest', icon: '🔮', tier: 'cosmos' },
    { id: 'void_aegis',    name: 'Void Aegis',    description: 'All spirit hits do 60% less damage',      cost: 15, x: 50, y: 90, req: 'phantom_pouch',      icon: '✴️', tier: 'cosmos' }
];

// Game State
let state = {
    instanceId: Math.random().toString(36).substring(2, 9),
    level: 1,
    motesToNextLevel: 500, // Legacy fallback, keeping for safety
    pods: 0,
    motes: 0,
    starFragments: 0,
    sparks: 0,
    tethers: [],
    sparkUpgrades: {
        astral_attunement: 0,
        luminous_stride: 0,
        tether_mastery: 0,
        celestial_pockets: 0,
        radiant_echo: 0,
        starlight_harvest: 0,
        void_shield: 0
    },
    settings: {
        masterVolume: 80,
        bgmVolume: 80,
        sfxVolume: 80,
        showParticles: true,
        screenshake: true,
        reducedMotion: false,
        colorblind: 'off',  // 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia'
        // v3.1 new settings
        performanceMode: false, // disables fog, fireflies, trail particles
        worldEvents: true,      // allow random world events to fire
        cameraZoom: 1.0         // 0.85 = zoom out, 1.0 = default
    },
    buildMode: { active: false, sourceId: null, targetId: null },
    buffs: {
        active: false,
        timer: 0
    },
    companions: [],
    voidSpirits: [],
    remnants: [],
    spiritIntervalId: null,
    burst: { active: false, x: 0, y: 0, radius: 0, maxRadius: 160, cooldown: 0, maxCooldown: 120 },
    boosts: {
        active: {}, // tracks remaining seconds for each boost: { mote_2x: 300 }
        moteMultiplier: 1,
        speedMultiplier: 1
    },
    combo: {
        count: 0,
        multiplier: 1,
        timer: 0,
        maxTimer: 180, // 3 seconds at 60fps
        frenzy: false
    },
    stats: {
        totalPodsHarvested: 0,
        totalStarsHarvested: 0,
        totalMotesEarned: 0,
        upgradesBoughtThisLevel: 0
    },
    player: new Proxy({
        x: 1000,
        y: 1000,
        speed: 4,
        radius: 20,
        maxPods: 20,
        sprite: '✨',
        glowColor: 'rgba(0, 242, 255, 0.3)'
    }, {
        set(target, prop, value) {
            if ((prop === 'x' || prop === 'y') && Math.abs(target[prop] - value) > 100) {
                console.warn(`TELEPORT DETECTED: ${prop} changed from ${target[prop]} to ${value}`);
                console.trace();
            }
            target[prop] = value;
            return true;
        }
    }),
    world: { width: 2000, height: 2000 },
    camera: { x: 0, y: 0, lerp: 0.1 },
    joystick: { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0, vector: { x: 0, y: 0 } },
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false },
    isTouch: false,
    entities: [],
    // v3.0 Balance: smoother early curves, milestone scaling, deeper late-game ceilings
    upgrades: [
        { id: 'speed', name: 'Swift Essence', description: 'Increase movement speed', basePrice: 15, priceMult: 1.45, level: 0, effect: (lvl) => 4 + Math.sqrt(lvl) * 1.4, currency: 'motes' },
        { id: 'harvest', name: 'Resonant Aura', description: 'Wider harvesting range', basePrice: 35, priceMult: 1.4, level: 0, effect: (lvl) => 80 + lvl * 18 + Math.sqrt(lvl) * 12, currency: 'motes' },
        { id: 'capacity', name: 'Void Pouch', description: 'Hold more Spore Pods', basePrice: 25, priceMult: 1.42, level: 0, effect: (lvl) => 20 + Math.floor(lvl * 12 + Math.pow(lvl, 1.15)), currency: 'motes' },
        { id: 'forge_speed', name: 'Forge Resonance', description: 'Faster pod conversion', basePrice: 30, priceMult: 1.5, level: 0, effect: (lvl) => 0.5 + lvl * 0.35, currency: 'motes' },
        { id: 'regrowth', name: 'Nature\'s Bounty', description: 'Trees regrow faster', basePrice: 45, priceMult: 1.55, level: 0, effect: (lvl) => 0.006 + lvl * 0.0028, currency: 'motes' },
        { id: 'wisp', name: 'Luminous Companion', description: 'Auto-harvests pods nearby', basePrice: 70, priceMult: 1.85, level: 0, effect: (lvl) => lvl, currency: 'motes' },
        { id: 'mote_magnet', name: 'Mote Magnet', description: 'Automatically pull motes from further away', basePrice: 120, priceMult: 1.75, level: 0, effect: (lvl) => 120 + lvl * 35, currency: 'motes' },
        { id: 'crit_harvest', name: 'Critical Bloom', description: 'Chance to get double pods', basePrice: 175, priceMult: 1.9, level: 0, effect: (lvl) => Math.min(0.6, lvl * 0.06), currency: 'motes' },
        { id: 'light_weaver', name: 'Light Weaver', description: 'Unlock Light Tethers to automate harvesting', basePrice: 2, priceMult: 1.4, level: 0, effect: (lvl) => lvl, currency: 'starFragments' },
        { id: 'star_blessing', name: 'Stellar Blessing', description: 'Increases all Mote gains', basePrice: 4, priceMult: 1.65, level: 0, effect: (lvl) => 1 + lvl * 0.6, currency: 'starFragments' },
        { id: 'sentinel', name: 'Void Sentinel', description: 'A defensive orb that dispels spirits attacking tethers.', basePrice: 8, priceMult: 2.1, level: 0, effect: (lvl) => lvl, currency: 'starFragments' },
        // v3.1 Active abilities — one-shot unlocks per run (priceMult=1, maxLevel=1)
        { id: 'ability_dash',  name: 'Luminous Dash',  description: 'Unlock Q — dash forward, stun nearby spirits.',        basePrice: 800,  priceMult: 1, level: 0, effect: (lvl) => lvl, currency: 'motes', maxLevel: 1 },
        { id: 'ability_pulse', name: 'Chrono-Pulse',   description: 'Unlock E — freeze spirits, boost regrowth nearby.',    basePrice: 1500, priceMult: 1, level: 0, effect: (lvl) => lvl, currency: 'motes', maxLevel: 1 },
        { id: 'ability_ward',  name: 'Spirit Ward',    description: 'Unlock R — shield all tethers for 12s.',               basePrice: 2500, priceMult: 1, level: 0, effect: (lvl) => lvl, currency: 'motes', maxLevel: 1 }
    ],
    cosmetics: [
        { id: 'default',     key: 'spark',         name: 'Spark',         icon: '✨', price: 0,     unlocked: true },
        { id: 'butterfly',   key: 'faerie',        name: 'Faerie',        icon: '🦋', price: 1000,  unlocked: false },
        { id: 'fairy',       key: 'sprite',        name: 'Sprite',        icon: '🧚', price: 5000,  unlocked: false },
        { id: 'lantern',     key: 'lantern',       name: 'Lantern',       icon: '🏮', price: 10,    currency: 'starFragments', unlocked: false },
        // v3.1 new cosmetics
        { id: 'wisp',        key: 'orbwisp',       name: 'Orb Wisp',      icon: '🟢', price: 2500,  unlocked: false },
        { id: 'phoenix',     key: 'phoenix',       name: 'Phoenix',       icon: '🔥', price: 8000,  unlocked: false },
        { id: 'moth',        key: 'moth',          name: 'Dusk Moth',     icon: '🌙', price: 5,     currency: 'starFragments', unlocked: false },
        { id: 'lotus',       key: 'lotus',         name: 'Lotus Bloom',   icon: '🪷', price: 12000, unlocked: false },
        // Boss-locked cosmetics (unlocked by defeating bosses)
        { id: 'voidcrown',         key: 'voidcrown',         name: 'Voidcrown',         icon: '👑', price: 0, unlocked: false, bossLocked: 'spirit_lord' },
        { id: 'sovereign_crown',   key: 'sovereign_crown',   name: 'Sovereign Crown',   icon: '👑', price: 0, unlocked: false, bossLocked: 'eclipse_sovereign' }
    ],
    abilities: { dash: { triggeredAt: 0, cdMs: 12000 }, pulse: { triggeredAt: 0, cdMs: 25000 }, ward: { triggeredAt: 0, cdMs: 30000 } },
    entityMap: {}, // $O(1)$ lookup cache
    activeSpiritType: 'glimmer' // Randomized every 5 levels
};

// Objective Definitions
function getLevelObjective(level) {
    // v3.0: smoother early ramp, rotating objective types for variety
    const objectives = [
        { type: 'collect_motes', target: 40, desc: 'Gather Motes' },        // L1
        { type: 'harvest_pods', target: 80, desc: 'Harvest Spore Pods' },   // L2
        { type: 'buy_upgrades', target: 2, desc: 'Purchase Mystic Upgrades' }, // L3
        { type: 'collect_motes', target: 350, desc: 'Gather Motes' },       // L4
        { type: 'harvest_pods', target: 220, desc: 'Harvest Spore Pods' },  // L5
        { type: 'collect_motes', target: 800, desc: 'Gather Motes' },       // L6
        { type: 'buy_upgrades', target: 3, desc: 'Purchase Mystic Upgrades' }, // L7
        { type: 'harvest_pods', target: 500, desc: 'Harvest Spore Pods' }   // L8
    ];
    if (level <= objectives.length) return objectives[level - 1];
    // Beyond defined levels: alternate mote/pod objectives with tempered exponential
    const beyond = level - objectives.length;
    const base = level % 2 === 0 ? 600 : 1000;
    const target = Math.floor(base * Math.pow(1.32, beyond));
    return level % 2 === 0
        ? { type: 'harvest_pods', target, desc: 'Harvest Spore Pods' }
        : { type: 'collect_motes', target, desc: 'Gather Motes' };
}

function getObjectiveProgress(objective) {
    switch (objective.type) {
        case 'collect_motes': return Math.floor(state.motes);
        case 'harvest_pods': return Math.floor(state.stats.totalPodsHarvested);
        case 'buy_upgrades': return state.stats.upgradesBoughtThisLevel;
        default: return 0;
    }
}

// v3.0: Richer biome palettes (deep -> mid -> accent), refined difficulty scaling
const biomes = {
    1: { name: 'Ethereal Grove', bg: '#0f0524', bgMid: '#1f0a3a', accent: '#bc00ff', accent2: '#00f2ff', spiritInterval: 14000, spiritSpeed: 0.9, regrowth: 1.1, bgmFreqs: [110, 164.81, 220], fogColor: 'rgba(188, 0, 255, 0.06)' },
    4: { name: 'Whispering Canopy', bg: '#0a1a18', bgMid: '#16332c', accent: '#a2ff00', accent2: '#00f2ff', spiritInterval: 12000, spiritSpeed: 1.05, regrowth: 1.15, bgmFreqs: [123.47, 174.61, 246.94], fogColor: 'rgba(162, 255, 0, 0.06)' },
    7: { name: 'Bioluminescent Depths', bg: '#051b24', bgMid: '#0a3340', accent: '#00f2ff', accent2: '#bc00ff', spiritInterval: 10500, spiritSpeed: 1.25, regrowth: 1.0, bgmFreqs: [98, 146.83, 196], fogColor: 'rgba(0, 242, 255, 0.07)' },
    11: { name: 'Radiant Hollows', bg: '#241a05', bgMid: '#3a2e0a', accent: '#ffd700', accent2: '#ff9d00', spiritInterval: 9000, spiritSpeed: 1.45, regrowth: 1.25, bgmFreqs: [130.81, 196, 261.63], fogColor: 'rgba(255, 215, 0, 0.07)' },
    14: { name: 'Cinder Sanctum', bg: '#240a0a', bgMid: '#3a1414', accent: '#ff007b', accent2: '#ff9d00', spiritInterval: 8000, spiritSpeed: 1.65, regrowth: 0.95, bgmFreqs: [87.31, 130.81, 174.61], fogColor: 'rgba(255, 0, 123, 0.08)' },
    18: { name: 'The Void',            bg: '#070310', bgMid: '#0e0820', accent: '#8a4dff', accent2: '#444444', spiritInterval: 6500, spiritSpeed: 2.0, regrowth: 0.8, bgmFreqs: [82.41, 123.47, 164.81], fogColor: 'rgba(138, 77, 255, 0.1)' },
    // v3.1 new biomes — extend the world deeper
    22: { name: 'Frostbloom Tundra',   bg: '#0a1418', bgMid: '#15303a', accent: '#aaeaff', accent2: '#ffffff', spiritInterval: 7500, spiritSpeed: 1.8, regrowth: 0.85, bgmFreqs: [110, 146.83, 220], fogColor: 'rgba(170, 234, 255, 0.08)' },
    26: { name: 'Crimson Spire',       bg: '#180408', bgMid: '#3a0a14', accent: '#ff3a5a', accent2: '#ff9d00', spiritInterval: 5800, spiritSpeed: 2.1, regrowth: 0.9,  bgmFreqs: [92.5, 138.59, 185], fogColor: 'rgba(255, 58, 90, 0.09)' },
    30: { name: 'Astral Sanctum',      bg: '#02060e', bgMid: '#0a1430', accent: '#ffd700', accent2: '#00f2ff', spiritInterval: 5000, spiritSpeed: 2.3, regrowth: 1.1,  bgmFreqs: [73.42, 110, 146.83], fogColor: 'rgba(255, 215, 0, 0.10)' },
    35: { name: 'Mycelial Deep',       bg: '#10081a', bgMid: '#1f0c2e', accent: '#a2ff00', accent2: '#bc00ff', spiritInterval: 4500, spiritSpeed: 2.4, regrowth: 1.0,  bgmFreqs: [98, 130.81, 164.81], fogColor: 'rgba(162, 255, 0, 0.10)' },
    42: { name: 'The Eternal',         bg: '#000000', bgMid: '#0a0a14', accent: '#ffffff', accent2: '#8a4dff', spiritInterval: 4000, spiritSpeed: 2.6, regrowth: 0.9,  bgmFreqs: [65.41, 98, 130.81], fogColor: 'rgba(255, 255, 255, 0.08)' }
};

function updateBiome() {
    const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
    const activeThreshold = thresholds.find(t => state.level >= t) || 1;
    const biome = biomes[activeThreshold];

    // Visuals (v3.0: layered biome palette pushed to CSS vars)
    document.documentElement.style.setProperty('--bg-deep', biome.bg);
    document.documentElement.style.setProperty('--bg-mid', biome.bgMid || biome.bg);
    document.documentElement.style.setProperty('--biome-accent', biome.accent);
    document.documentElement.style.setProperty('--biome-accent-2', biome.accent2 || biome.accent);
    document.documentElement.style.setProperty('--biome-fog', biome.fogColor || 'rgba(188,0,255,0.06)');

    // Refresh background gradient with mid-tone for depth
    const container = document.querySelector('.game-container');
    if (container) {
        container.style.background = `radial-gradient(ellipse at 50% 40%, ${biome.bgMid || biome.bg} 0%, ${biome.bg} 55%, #000 100%)`;
    }
    const world = document.getElementById('game-world');
    if (world) {
        world.style.setProperty('--world-accent', biome.accent);
        world.style.setProperty('--world-accent-2', biome.accent2 || biome.accent);
    }

    // Mechanics
    if (state.spiritIntervalId) clearInterval(state.spiritIntervalId);
    state.spiritIntervalId = setInterval(spawnVoidSpirit, biome.spiritInterval);

    // Audio Shift
    if (isAudioInitialized && bgmOscillators.length > 0) {
        bgmOscillators.forEach((osc, i) => {
            if (biome.bgmFreqs[i]) {
                osc.frequency.setTargetAtTime(biome.bgmFreqs[i], audioCtx.currentTime, 2);
            }
        });
    }
}

const HARVEST_RANGE = 100;

// DOM Elements
const playerEl = document.getElementById('player');
const gameWorld = document.getElementById('game-world');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const podsDisplay = document.getElementById('pods-count');
const motesDisplay = document.getElementById('motes-count');
const entitiesLayer = document.getElementById('entities');
const upgradesToggle = document.getElementById('upgrades-toggle');
const closeUpgrades = document.getElementById('close-upgrades');
const upgradesPanel = document.getElementById('upgrades-panel');
const upgradeList = document.querySelector('.upgrade-list');
const cosmeticsToggle = document.getElementById('cosmetics-toggle');
const closeCosmetics = document.getElementById('close-cosmetics');
const cosmeticsPanel = document.getElementById('cosmetics-panel');
const cosmeticList = document.querySelector('.cosmetic-list');
const minimapContent = document.getElementById('minimap-content');
const starsItem = document.getElementById('stars-item');
const starsCount = document.getElementById('stars-count');
const sparksItem = document.getElementById('sparks-item');
const sparksCount = document.getElementById('sparks-count');
const buffDisplay = document.getElementById('buff-display');
const buffTimer = document.getElementById('buff-timer');
const ascendToggle = document.getElementById('ascend-toggle');
const ascendPanel = document.getElementById('ascend-panel');
const closeAscend = document.getElementById('close-ascend');
const confirmAscend = document.getElementById('confirm-ascend');
const ascendReward = document.getElementById('ascend-reward');
const buildToggle = document.getElementById('build-toggle');
const svgLayer = document.getElementById('svg-layer');
const burstBtn = document.getElementById('burst-btn');
const burstFill = document.getElementById('burst-cooldown-fill');
const tetherCountDisplay = document.getElementById('tether-count');

const astralToggle = document.getElementById('astral-toggle');
const astralPanel = document.getElementById('astral-panel');
const closeAstral = document.getElementById('close-astral');
const astralTree = document.getElementById('astral-tree');
const astralSparkCount = document.getElementById('astral-spark-count');
const beginNextRun = document.getElementById('begin-next-run');

const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');
const exportSaveBtn = document.getElementById('export-save');
const importSaveBtn = document.getElementById('import-save');
const wipeSaveBtn = document.getElementById('wipe-save');
const settingsMsg = document.getElementById('settings-msg');

// Level DOM Elements
const levelDisplay = document.getElementById('level-display');
const objectiveDesc = document.getElementById('objective-desc');
const objectiveProgress = document.getElementById('objective-progress');
const objectiveTarget = document.getElementById('objective-target');
const levelUpBtn = document.getElementById('level-up-btn');
const mainMenu = document.getElementById('main-menu');
const startGameBtn = document.getElementById('start-game');
const menuSettingsBtn = document.getElementById('menu-settings-toggle');

const buffTimerFill = document.getElementById('buff-timer-fill');

const comboContainer = document.getElementById('combo-container');
const comboMultiplier = document.querySelector('.combo-multiplier');
const comboFill = document.getElementById('combo-fill');
const frenzyIndicator = document.getElementById('frenzy-indicator');
const appEl = document.getElementById('app');

function updateEntityMap() {
    state.entityMap = {};
    state.entities.forEach(e => state.entityMap[e.id] = e);
}

function randomizeSpiritType() {
    const types = ['glimmer', 'creeper', 'flare', 'shade'];
    // Randomly select a type that is different from the current one if possible
    let newType;
    do {
        newType = types[Math.floor(Math.random() * types.length)];
    } while (newType === state.activeSpiritType && types.length > 1);

    state.activeSpiritType = newType;
    console.log(`NEW SPIRIT THEME: ${state.activeSpiritType.toUpperCase()}`);
}

function initWorld() {
    entitiesLayer.innerHTML = '';

    if (state.entities && state.entities.length > 0) {
        state.entities.forEach(renderEntity);
        gameWorld.style.width = `${state.world.width}px`;
        gameWorld.style.height = `${state.world.height}px`;
        initMinimap();
        return;
    }

    state.entities = [];
    const centerX = state.world.width / 2;
    const centerY = state.world.height / 2;

    // Initialize spirit type if not set
    if (!state.activeSpiritType) randomizeSpiritType();
    // Every 5 levels, pick a new theme
    if (state.level % 5 === 1 && state.level > 1) {
        // Only randomize once per 5-level block
        // We check if we just entered this block
    }

    const forge = { id: 'light-forge', x: centerX, y: centerY, type: 'forge' };
    state.entities.push(forge);

    if (Math.random() < 0.5) { // 50% chance per area
        let sx, sy;
        do {
            sx = Math.random() * (state.world.width - 300) + 150;
            sy = Math.random() * (state.world.height - 300) + 150;
        } while (Math.abs(sx - centerX) < 500 && Math.abs(sy - centerY) < 500); // Shrines spawn far away

        state.entities.push({ id: 'shrine-gen', x: sx, y: sy, type: 'shrine' });
    }

    const numObstacles = 10 + (state.level * 5);
    for (let i = 0; i < numObstacles; i++) {
        const isRock = Math.random() < 0.5;
        const obstacle = {
            id: `obs-${state.level}-${i}`,
            x: Math.random() * (state.world.width - 200) + 100,
            y: Math.random() * (state.world.height - 200) + 100,
            type: 'obstacle',
            subType: isRock ? 'rock' : 'vine',
            radius: isRock ? 25 : 30
        };
        // Avoid spawning on forge, player starting area, and shrines
        if (Math.abs(obstacle.x - centerX) < 250 && Math.abs(obstacle.y - centerY) < 250) continue;

        // Simple overlap check against other entities
        let overlap = false;
        for (const e of state.entities) {
            const dist = Math.sqrt(Math.pow(obstacle.x - e.x, 2) + Math.pow(obstacle.y - e.y, 2));
            if (dist < 60) { overlap = true; break; }
        }
        if (!overlap) state.entities.push(obstacle);
    }

    const numTrees = 15 + (state.level * 5);

    for (let i = 0; i < numTrees; i++) {
        // v3.0: smoother star-tree scaling, capped so they remain special
        const isStar = Math.random() < Math.min(0.18, 0.04 + state.level * 0.008);
        const tree = {
            id: `tree-${state.level}-${i}`,
            x: Math.random() * (state.world.width - 300) + 150,
            y: Math.random() * (state.world.height - 300) + 150,
            type: 'tree',
            subType: isStar ? 'star-tree' : 'normal',
            pods: isStar ? 1 : 10
        };
        if (Math.abs(tree.x - centerX) < 200 && Math.abs(tree.y - centerY) < 200) continue;
        state.entities.push(tree);
    }

    gameWorld.style.width = `${state.world.width}px`;
    gameWorld.style.height = `${state.world.height}px`;
    updateEntityMap();
    state.entities.forEach(renderEntity);
    initMinimap();
    renderTethers();
}

function initMinimap() {
    minimapContent.innerHTML = '<div id="minimap-player" class="minimap-dot player-dot"></div>';
    state.entities.forEach(entity => {
        const dot = document.createElement('div');
        dot.className = `minimap-dot ${entity.type}-dot`;
        if (entity.type === 'shrine') dot.className += ' shrine-dot';
        if (entity.type === 'obstacle') dot.className += ` ${entity.subType}-dot`;
        dot.id = `map-${entity.id}`;
        minimapContent.appendChild(dot);
    });
    updateMinimap();
}

function updateMinimap() {
    const playerDot = document.getElementById('minimap-player');
    if (!playerDot) return;

    playerDot.style.left = `${(state.player.x / state.world.width) * 100}%`;
    playerDot.style.top = `${(state.player.y / state.world.height) * 100}%`;

    state.entities.forEach(entity => {
        const dot = document.getElementById(`map-${entity.id}`);
        if (dot) {
            dot.style.left = `${(entity.x / state.world.width) * 100}%`;
            dot.style.top = `${(entity.y / state.world.height) * 100}%`;
            if (entity.type === 'tree') {
                dot.style.opacity = Math.max(0.2, entity.pods / (entity.subType === 'star-tree' ? 1 : 10));
                if (entity.subType === 'star-tree') {
                    dot.style.background = 'var(--neon-gold)';
                    dot.style.boxShadow = '0 0 4px var(--neon-gold)';
                }
            }
        }
    });
}

function updateWorldColors() {
    updateBiome();
}

function reconnectTethers() {
    if (state.tethers.length === 0) return;

    const forge = state.entities.find(e => e.type === 'forge');
    const trees = state.entities.filter(e => e.type === 'tree' && e.subType !== 'star-tree');

    // Sort trees by distance to forge to reconnect to the most "central" ones
    trees.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - forge.x, 2) + Math.pow(a.y - forge.y, 2));
        const distB = Math.sqrt(Math.pow(b.x - forge.x, 2) + Math.pow(b.y - forge.y, 2));
        return distA - distB;
    });

    const newTethers = [];
    for (let i = 0; i < state.tethers.length; i++) {
        if (trees[i]) {
            newTethers.push({
                sourceId: trees[i].id,
                targetId: forge.id
            });
        }
    }
    state.tethers = newTethers;
    updateEntityMap(); // Entities changed
    renderTethers();
}

function advanceLevel() {
    const objective = getLevelObjective(state.level);
    const progress = getObjectiveProgress(objective);

    // Gate: defeat any active boss before continuing
    if (state.activeBoss) {
        showAchievementToast({ icon: '⚔️', name: 'Boss Still Active', reward: { motes: 0 } });
        const t = document.getElementById('achievement-toast');
        if (t) t.querySelector('.ach-reward').textContent = `Defeat ${state.activeBoss.def.name} first.`;
        return;
    }

    if (progress >= objective.target) {
        const warp = document.getElementById('warp-overlay');
        const toast = document.getElementById('biome-toast');
        const title = document.getElementById('biome-title');
        const bDesc = document.getElementById('biome-desc');

        // Trigger Warp Sequence
        warp.classList.add('flashing');
        playerEl.classList.add('player-warp');
        playTone(300, 'sine', 1.0, 0.8, true);

        setTimeout(() => {
            // Deduct motes if it was a mote objective
            if (objective.type === 'collect_motes') {
                state.motes -= objective.target;
            }

            state.level++;
            // Lifetime: track highest area reached
            state.lifetime.area = Math.max(state.lifetime.area || 0, state.level);
            state.runRecords.highestArea = Math.max(state.runRecords.highestArea || 0, state.level);
            // Spawn boss for this area if applicable (run loop will see state.activeBoss next tick)
            // We defer to after world rebuild so the boss spawns into the fresh world
            state.stats.upgradesBoughtThisLevel = 0;
            state.stats.totalPodsHarvested = 0;

            state.world.width += 500;
            state.world.height += 500;
            state.player.x = state.world.width / 2;
            state.player.y = state.world.height / 2;

            state.entities = [];
            // Clear any boss from previous area
            if (state.activeBoss && state.activeBoss.el) state.activeBoss.el.remove();
            if (state.activeBoss && state.activeBoss.telegraphEl) state.activeBoss.telegraphEl.remove();
            state.activeBoss = null;
            hideBossHpBar();
            initWorld();
            reconnectTethers();
            // Spawn boss for the new area
            spawnBossForArea();
            // Maybe spawn a hidden secret in the new area
            maybeSpawnSecret();

            // Randomize Spirit Theme every 5 levels
            if (state.level % 5 === 1) {
                randomizeSpiritType();
            }

            updateWorldColors();
            updateHUD();

            // Biome Toast
            const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
            const activeThreshold = thresholds.find(t => state.level >= t) || 1;
            const biome = biomes[activeThreshold];

            title.textContent = biome.name.toUpperCase();
            bDesc.textContent = `AREA ${state.level} DISCOVERED`;
            toast.classList.add('show');

            playLevelUpSound();
            saveGame();

            setTimeout(() => {
                warp.classList.remove('flashing');
                playerEl.classList.remove('player-warp');
                toast.classList.remove('show');
            }, 3000);
        }, 400);
    }
}

// ============================================================
// v3.0: Daily Seed — deterministic world per UTC day
// ============================================================
function getTodaySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
// Seeded PRNG (mulberry32) — used when state.dailyMode is true
let seededRng = null;
function setSeed(seed) {
    let a = seed >>> 0;
    seededRng = function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Override Math.random when in daily mode for deterministic worlds
const _origRandom = Math.random;
function patchRandomForDaily() {
    Math.random = function () { return seededRng ? seededRng() : _origRandom(); };
}
function unpatchRandom() { Math.random = _origRandom; seededRng = null; }

state.dailyMode = false;
state.dailyBest = state.dailyBest || {}; // { [seed]: { level, motes, ts } }
state.runSnapshots = state.runSnapshots || { main: null, daily: null };

// Capture all run-tied state into a portable snapshot
function captureRunSnapshot() {
    return {
        savedAt: Date.now(),
        level: state.level,
        motes: Number(state.motes),
        pods: Number(state.pods),
        starFragments: Number(state.starFragments),
        world: { width: state.world.width, height: state.world.height },
        playerX: state.player.x,
        playerY: state.player.y,
        upgrades: state.upgrades.map(u => ({ id: u.id, level: Number(u.level) || 0 })),
        stats: {
            totalPodsHarvested: state.stats.totalPodsHarvested,
            totalStarsHarvested: state.stats.totalStarsHarvested,
            totalMotesEarned: state.stats.totalMotesEarned,
            upgradesBoughtThisLevel: state.stats.upgradesBoughtThisLevel
        },
        entities: state.entities.map(e => { const { el, ...rest } = e; return rest; }),
        tethers: state.tethers.map(t => ({ sourceId: t.sourceId, targetId: t.targetId, health: t.health, maxHealth: t.maxHealth })),
        remnants: state.remnants.map(r => ({ sourceId: r.sourceId, targetId: r.targetId, maxHealth: r.maxHealth })),
        companions: state.companions.map(c => ({ id: c.id, x: c.x, y: c.y, variant: c.variant })),
        runStartSec: state._runStartSec ?? null
    };
}

// Apply a run snapshot back into state; rebuilds DOM
function applyRunSnapshot(snap) {
    if (!snap) return;
    state.level = snap.level;
    state.motes = Number(snap.motes) || 0;
    state.pods = Number(snap.pods) || 0;
    state.starFragments = Number(snap.starFragments) || 0;
    state.world = { width: snap.world.width, height: snap.world.height };
    state.player.x = snap.playerX;
    state.player.y = snap.playerY;
    state.stats = { ...state.stats, ...snap.stats };
    state._runStartSec = snap.runStartSec;

    // Upgrades — restore levels by id
    if (Array.isArray(snap.upgrades)) {
        snap.upgrades.forEach(saveU => {
            const u = state.upgrades.find(upg => upg.id === saveU.id);
            if (u) u.level = Number(saveU.level) || 0;
        });
    }

    // Recompute permanent bonuses applied to player
    const speedBonus = 1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0);
    const capBonus = state.sparkUpgrades.celestial_pockets ? 50 : 0;
    const speedU = state.upgrades.find(u => u.id === 'speed');
    const capU = state.upgrades.find(u => u.id === 'capacity');
    state.player.speed = (speedU ? speedU.effect(speedU.level) : 4) * speedBonus;
    state.player.maxPods = (capU ? capU.effect(capU.level) : 20) + capBonus;

    // World structure
    state.entities = (snap.entities || []).map(e => ({ ...e }));
    state.tethers = (snap.tethers || []).map(t => ({ ...t }));
    state.remnants = (snap.remnants || []).map(r => ({ ...r }));

    // Clear transient entities & DOM
    state.voidSpirits.forEach(s => { if (s.el) s.el.remove(); });
    state.voidSpirits = [];
    state.companions.forEach(c => { if (c.el) c.el.remove(); });
    state.companions = (snap.companions || []).map(c => ({ id: c.id, x: c.x, y: c.y, variant: c.variant || 'sentinel' }));
    state.buildMode.active = false;
    state.buildMode.sourceId = null;

    // Camera recenters on player
    state.camera.x = window.innerWidth / 2 - state.player.x;
    state.camera.y = window.innerHeight / 2 - state.player.y;

    // Rebuild world DOM
    gameWorld.style.width = `${state.world.width}px`;
    gameWorld.style.height = `${state.world.height}px`;
    entitiesLayer.innerHTML = '';
    state.entities.forEach(renderEntity);
    updateEntityMap();
    initMinimap();
    renderTethers();
    state.companions.forEach(c => spawnCompanionElement(c));
}

// Toggle the daily-mode UI banner + live score readout
function updateDailyBanner() {
    const banner = document.getElementById('daily-banner');
    if (!banner) return;
    banner.style.display = state.dailyMode ? 'flex' : 'none';
    if (!state.dailyMode) return;
    const seed = getTodaySeed();
    const best = state.dailyBest?.[seed]?.motes || 0;
    const cur = Math.floor(state.stats.totalMotesEarned || 0);
    const textEl = banner.querySelector('.db-text');
    if (textEl) {
        const beating = best > 0 && cur > best;
        textEl.innerHTML = `Daily · <strong>${formatNumber(cur)}</strong>${best > 0 ? ` <span style="opacity:0.6">/ best ${formatNumber(best)}</span>` : ''}${beating ? ' <span style="color: var(--neon-lime); font-weight: 800;">NEW BEST</span>' : ''}`;
    }
}
// Live tick the banner once per second
setInterval(updateDailyBanner, 1000);

function startDailyChallenge() {
    const seed = getTodaySeed();

    // If we're currently in the main run, snapshot it so we can return later
    if (!state.dailyMode) {
        state.runSnapshots.main = captureRunSnapshot();
    }

    // Discard a stale daily snapshot from a previous day
    if (state.runSnapshots.daily && state.runSnapshots.daily.seed !== seed) {
        state.runSnapshots.daily = null;
    }

    state.dailyMode = true;
    setSeed(seed);
    patchRandomForDaily();

    // Resume an in-progress daily for today's seed, or initialize a fresh one
    if (state.runSnapshots.daily && state.runSnapshots.daily.seed === seed) {
        applyRunSnapshot(state.runSnapshots.daily);
        updateWorldColors();
        updateHUD();
        renderUpgrades();
        showBiomeToast('DAILY RESUMED', `Seed #${seed}`);
    } else {
        // Lifetime: count this as a new run only on a fresh daily start
        state.lifetime.runs = (state.lifetime.runs || 0) + 1;
        state._runStartSec = state.lifetime.playSec || 0;

        // Fresh daily run — isolated from main (currency reset)
        state.level = 1;
        state.motes = 0;
        state.pods = 0;
        state.starFragments = 0;
        state.world = { width: 2000, height: 2000 };
        state.stats.totalMotesEarned = 0;
        state.stats.upgradesBoughtThisLevel = 0;
        state.stats.totalPodsHarvested = 0;
        state.upgrades.forEach(u => u.level = 0);
        state.player.speed = state.upgrades.find(u => u.id === 'speed').effect(0);
        state.player.maxPods = state.upgrades.find(u => u.id === 'capacity').effect(0);
        state.player.x = 1000; state.player.y = 1000;
        state.camera.x = 0; state.camera.y = 0;
        // Clear companion DOM before nuking the array
        state.companions.forEach(c => { if (c.el) c.el.remove(); });
        state.entities = []; state.tethers = []; state.remnants = []; state.companions = [];
        state.voidSpirits.forEach(s => { if (s.el) s.el.remove(); });
        state.voidSpirits = [];
        state.buildMode.active = false;

        initWorld();
        updateWorldColors();
        updateHUD();
        renderUpgrades();
        showBiomeToast('DAILY CHALLENGE', `Seed #${seed}`);
    }
    updateDailyBanner();
    saveGame();
}

// Record best score (called both on ascend and on manual exit)
function recordDailyBest() {
    const seed = getTodaySeed();
    const score = Math.floor(state.stats.totalMotesEarned);
    const prev = state.dailyBest[seed] || { motes: 0, level: 0 };
    if (score > prev.motes) {
        state.dailyBest[seed] = { motes: score, level: state.level, ts: Date.now() };
        showAchievementToast({ icon: '🏅', name: 'New Daily Best!', reward: { motes: 0 } });
        const t = document.getElementById('achievement-toast');
        if (t) t.querySelector('.ach-reward').textContent = `${score} motes • Area ${state.level}`;
        // Push daily score to global leaderboard
        cloudSubmitScore('daily', String(seed), score, state.level);
        return true;
    }
    return false;
}

// Called by handleAscend — daily run completed, score recorded, no snapshot kept
function endDailyChallenge() {
    if (!state.dailyMode) return;
    recordDailyBest();
    state.runSnapshots.daily = null; // ascension completes the daily — no resume
    state.dailyMode = false;
    unpatchRandom();
    // Restore main run so the player lands back in their main world
    if (state.runSnapshots.main) {
        applyRunSnapshot(state.runSnapshots.main);
        updateWorldColors();
        updateHUD();
        renderUpgrades();
    }
    updateDailyBanner();
    saveGame();
}

// Manual exit from daily back to main — daily progress is snapshotted for later resume
function exitDailyToMain() {
    if (!state.dailyMode) return;
    // Record best before snapshotting (so the leaderboard reflects current progress)
    recordDailyBest();
    // Snapshot current daily progress for resume
    state.runSnapshots.daily = { seed: getTodaySeed(), ...captureRunSnapshot() };

    state.dailyMode = false;
    unpatchRandom();

    if (state.runSnapshots.main) {
        applyRunSnapshot(state.runSnapshots.main);
        updateWorldColors();
        updateHUD();
        renderUpgrades();
        showBiomeToast('MAIN RUN RESUMED', `Area ${state.level}`);
    } else {
        // No prior main snapshot — should not happen in practice, but recover gracefully
        updateWorldColors();
        updateHUD();
    }
    updateDailyBanner();
    saveGame();
}

function showBiomeToast(title, desc) {
    const toast = document.getElementById('biome-toast');
    if (!toast) return;
    document.getElementById('biome-title').textContent = title;
    document.getElementById('biome-desc').textContent = desc;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================================
// v3.0: Companion progression — Guardian / Gatherer / Scholar variants
// ============================================================
const COMPANION_VARIANTS = {
    sentinel: { name: 'Sentinel',  icon: '🛡️', desc: 'Basic defender — dispels nearby spirits.',                color: 'cyan',   defenseRange: 400, harvestRate: 0,    moteBonus: 0 },
    guardian: { name: 'Guardian',  icon: '🛡️', desc: 'Stays close to tethers, larger dispel range.',           color: 'cyan',   defenseRange: 600, harvestRate: 0,    moteBonus: 0 },
    gatherer: { name: 'Gatherer',  icon: '🌿', desc: 'Auto-harvests pods from trees as it patrols.',           color: 'lime',   defenseRange: 300, harvestRate: 0.4,  moteBonus: 0 },
    scholar:  { name: 'Scholar',   icon: '📜', desc: 'Generates passive motes over time.',                     color: 'purple', defenseRange: 250, harvestRate: 0,    moteBonus: 0.6 }
};

// Mark each newly-spawned companion as 'sentinel' by default
const _origApplyUpgradeEffects = null; // unused placeholder
// ============================================================
// v3.0: Achievement system — milestone-based currency rewards
// ============================================================
const ACHIEVEMENTS = [
    { id: 'first_pod',      name: 'First Bloom',         icon: '🌱', desc: 'Harvest your first 50 pods',          getProgress: () => state.stats.totalPodsHarvested,  target: 50,    reward: { motes: 50 } },
    { id: 'pod_500',        name: 'Diligent Gatherer',   icon: '🌿', desc: 'Harvest 500 pods total',              getProgress: () => state.stats.totalPodsHarvested,  target: 500,   reward: { motes: 200 } },
    { id: 'pod_5000',       name: 'Harvest Master',      icon: '🌾', desc: 'Harvest 5,000 pods total',            getProgress: () => state.stats.totalPodsHarvested,  target: 5000,  reward: { motes: 1500 } },
    { id: 'motes_1k',       name: 'Glow Hoarder',        icon: '💠', desc: 'Earn 1,000 motes in this run',        getProgress: () => state.stats.totalMotesEarned,    target: 1000,  reward: { motes: 250 } },
    { id: 'motes_10k',      name: 'Luminous Magnate',    icon: '💎', desc: 'Earn 10,000 motes in this run',       getProgress: () => state.stats.totalMotesEarned,    target: 10000, reward: { starFragments: 5 } },
    { id: 'first_star',     name: 'Stellar Touch',       icon: '⭐', desc: 'Harvest your first Star Fragment',    getProgress: () => state.stats.totalStarsHarvested, target: 1,     reward: { motes: 500 } },
    { id: 'stars_25',       name: 'Constellation',       icon: '✨', desc: 'Harvest 25 Star Fragments',           getProgress: () => state.stats.totalStarsHarvested, target: 25,    reward: { starFragments: 10 } },
    { id: 'area_5',         name: 'Pathfinder',          icon: '🧭', desc: 'Reach Area 5',                        getProgress: () => state.level,                     target: 5,     reward: { motes: 1000 } },
    { id: 'area_10',        name: 'Voidwalker',          icon: '🌀', desc: 'Reach Area 10',                       getProgress: () => state.level,                     target: 10,    reward: { starFragments: 8 } },
    { id: 'area_20',        name: 'Eternal Wanderer',    icon: '🪐', desc: 'Reach Area 20',                       getProgress: () => state.level,                     target: 20,    reward: { starFragments: 20 } },
    { id: 'tethers_5',      name: 'Web of Light',        icon: '🔗', desc: 'Build 5 active tethers at once',      getProgress: () => state.tethers.length,            target: 5,     reward: { motes: 800 } },
    { id: 'first_ascend',   name: 'Transcendent',        icon: '🌠', desc: 'Ascend for the first time',           getProgress: () => state.sparks,                    target: 1,     reward: { motes: 2000 } },
    { id: 'sparks_25',      name: 'Eternal Light',       icon: '🌟', desc: 'Accumulate 25 Eternal Sparks',        getProgress: () => state.sparks,                    target: 25,    reward: { starFragments: 15 } }
];

// state.achievements: { [id]: { unlocked: bool, claimed: bool, unlockedAt: ts } }
state.achievements = state.achievements || {};

// ============================================================
// v3.0 Hub: profile + lifetime stats
// ============================================================
function generatePlayerId() {
    // Short readable ID: timestamp + random suffix
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.floor(Math.random() * 0xfffff).toString(16).toUpperCase().padStart(5, '0');
    return `LH-${ts}-${rnd}`;
}

// Themed username pools — bioluminescent forest flavor
const USERNAME_ADJECTIVES = [
    'Luminous', 'Verdant', 'Mystic', 'Radiant', 'Astral', 'Twilight', 'Glimmering', 'Ethereal',
    'Serene', 'Wandering', 'Whispering', 'Silent', 'Echoing', 'Crystalline', 'Iridescent', 'Stellar',
    'Lunar', 'Solar', 'Sylvan', 'Glowing', 'Drifting', 'Misty', 'Velvet', 'Auroral',
    'Cosmic', 'Hushed', 'Sapphire', 'Emerald', 'Amber', 'Lush', 'Bioluminescent', 'Quiet',
    'Dappled', 'Soft', 'Bright', 'Ancient', 'Spectral', 'Verdigris', 'Twin', 'Nebulous'
];
const USERNAME_NOUNS = [
    'Wanderer', 'Wisp', 'Sprite', 'Bloom', 'Glow', 'Echo', 'Ember', 'Lumen',
    'Sentinel', 'Stargazer', 'Pathfinder', 'Voyager', 'Wayfarer', 'Forager', 'Harvester', 'Tender',
    'Keeper', 'Seeker', 'Pilgrim', 'Drifter', 'Watcher', 'Dreamer', 'Whisper', 'Spark',
    'Lantern', 'Beacon', 'Mote', 'Sapling', 'Grove', 'Fern', 'Mirage', 'Reverie',
    'Spire', 'Thistle', 'Petal', 'Sigil', 'Halo', 'Aurora'
];
function generateUsername() {
    // Always use the unseeded RNG so daily-mode patching can't make names deterministic
    const rng = (typeof _origRandom === 'function') ? _origRandom : Math.random;
    const adj = USERNAME_ADJECTIVES[Math.floor(rng() * USERNAME_ADJECTIVES.length)];
    const noun = USERNAME_NOUNS[Math.floor(rng() * USERNAME_NOUNS.length)];
    return `${adj} ${noun}`;
}

state.profile = state.profile || { name: null, playerId: null, joined: null, title: null };
state.lifetime = state.lifetime || { runs: 0, ascensions: 0, motes: 0, area: 0, playSec: 0 };
state.streak = state.streak || { current: 0, longest: 0, lastUTCDay: null, rewardsClaimed: {} };

// ============================================================
// v3.2 Hidden Secrets — rare world entities with random effects
// ============================================================
const SECRET_DEFS = {
    wandering_sage: {
        key: 'wandering_sage', icon: '🧙', name: 'Wandering Sage',
        spawnWeight: 4,
        onTouch: () => {
            const choices = [
                { msg: 'Mote Blessing · 2× motes for 90s', apply: () => { state.boosts.active['sage_motes2x'] = 90; refreshMultipliers(); } },
                { msg: 'Swift Blessing · +30% speed for 90s', apply: () => { state.boosts.active['sage_speed'] = 90; refreshMultipliers(); } },
                { msg: 'Harvest Blessing · all trees refilled', apply: () => { state.entities.forEach(e => { if (e.type === 'tree') e.pods = e.subType === 'star-tree' ? 1 : 10; }); } },
                { msg: 'Spark of Insight · +1 ⭐', apply: () => { state.starFragments += 1; updateHUD(); } }
            ];
            const pick = choices[Math.floor(Math.random() * choices.length)];
            pick.apply();
            return pick.msg;
        }
    },
    lost_beacon: {
        key: 'lost_beacon', icon: '🗼', name: 'Lost Beacon',
        spawnWeight: 3,
        onTouch: () => {
            // Auto-tether the nearest unconnected tree to the forge
            const forge = state.entities.find(e => e.type === 'forge');
            if (!forge) return 'A beacon stirs… nothing happened.';
            const connectedIds = new Set(state.tethers.map(t => t.sourceId));
            let nearest = null, minD = Infinity;
            for (const e of state.entities) {
                if (e.type !== 'tree' || e.subType === 'star-tree') continue;
                if (connectedIds.has(e.id)) continue;
                const d = Math.hypot(e.x - forge.x, e.y - forge.y);
                if (d < minD) { minD = d; nearest = e; }
            }
            if (!nearest) return 'A beacon stirs… every tree is already tethered.';
            state.tethers.push({ sourceId: nearest.id, targetId: forge.id, health: 100, maxHealth: 100, fromBeacon: true });
            state.runRecords.peakTethers = Math.max(state.runRecords.peakTethers || 0, state.tethers.length);
            renderTethers();
            return 'A beacon stirs · free tether granted';
        }
    },
    phoenix_nest: {
        key: 'phoenix_nest', icon: '🪺', name: 'Phoenix Nest',
        spawnWeight: 2,
        onTouch: (entity) => {
            // Big payoff with a danger spike: 3 stars, but spawn 5 spirits
            state.starFragments += 3;
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    if (typeof spawnVoidSpirit === 'function') spawnVoidSpirit();
                }, i * 250);
            }
            triggerShake();
            return '+3 ⭐ but the nest awakens — spirits incoming!';
        }
    }
};

function maybeSpawnSecret() {
    // Roll once per area transition: ~25% chance overall, weighted across the three types
    if (state.dailyMode) return;             // dailies stay deterministic
    if (state.level < 3) return;             // give players some experience first
    if (Math.random() > 0.25) return;
    // Weighted pick
    const defs = Object.values(SECRET_DEFS);
    const totalWeight = defs.reduce((s, d) => s + d.spawnWeight, 0);
    let r = Math.random() * totalWeight;
    let pick = defs[0];
    for (const d of defs) { if ((r -= d.spawnWeight) <= 0) { pick = d; break; } }

    // Find a spawn spot away from the player and forge
    const centerX = state.world.width / 2;
    const centerY = state.world.height / 2;
    let sx, sy, tries = 0;
    do {
        sx = Math.random() * (state.world.width - 300) + 150;
        sy = Math.random() * (state.world.height - 300) + 150;
        tries++;
    } while (tries < 20 && (
        Math.hypot(sx - centerX, sy - centerY) < 300 ||
        Math.hypot(sx - state.player.x, sy - state.player.y) < 200
    ));

    const secret = {
        id: `secret-${pick.key}-${Date.now()}`,
        x: sx, y: sy,
        type: 'secret',
        subType: pick.key,
        defKey: pick.key
    };
    state.entities.push(secret);
    updateEntityMap();
    renderEntity(secret);
}

function tryInteractSecret(entity) {
    const def = SECRET_DEFS[entity.defKey];
    if (!def) return;
    recordCodexEncounter('secrets', def.key);
    const msg = def.onTouch(entity) || `${def.name} discovered!`;
    // Discovery toast (reuses achievement-toast styling)
    showAchievementToast({ icon: def.icon, name: def.name + ' Discovered', reward: { motes: 0 } });
    const t = document.getElementById('achievement-toast');
    if (t) {
        t.querySelector('.ach-label').textContent = 'HIDDEN SECRET';
        t.querySelector('.ach-reward').textContent = msg;
        t.style.borderColor = `var(--${CODEX_ENTRIES.secrets.find(s => s.key === def.key)?.color || 'neon-cyan'})`;
        setTimeout(() => { t.querySelector('.ach-label').textContent = 'Achievement Unlocked'; t.style.borderColor = ''; }, 4500);
    }
    playTone(660, 'sine', 0.4, 0.4); playTone(990, 'sine', 0.4, 0.3);

    // Remove the secret entity from world
    if (entity.el) entity.el.remove();
    state.entities = state.entities.filter(e => e.id !== entity.id);
    updateEntityMap();
    saveGame();
}

// ============================================================
// v3.2 Boss Rush — sequential arena, unlocked after defeating Eclipse Sovereign
// ============================================================
state.bossRush = state.bossRush || { unlocked: false, bestTimeSec: null, attempts: 0 };
function bossRushUnlocked() { return !!state.bosses?.defeatedEver?.eclipse_sovereign; }
function isInBossRush() { return !!state._bossRush; }

function startBossRush() {
    if (!bossRushUnlocked()) return;
    if (state.dailyMode) return; // can't start from inside a daily

    // Snapshot main run so we can restore on exit
    state.runSnapshots.main = captureRunSnapshot();
    state._bossRush = { startedAt: Date.now(), queue: ['spirit_lord', 'eclipse_sovereign'], current: 0 };
    state.bossRush.attempts = (state.bossRush.attempts || 0) + 1;

    // Reset run state into an arena: small world, fresh upgrades, no objective
    state.level = 99;            // sentinel value so objective text reads as 'arena'
    state.motes = 0;
    state.pods = 0;
    state.world = { width: 1600, height: 1600 };
    state.entities = []; state.tethers = []; state.companions = [];
    state.voidSpirits.forEach(s => { if (s.el) s.el.remove(); });
    state.voidSpirits = [];
    state.upgrades.forEach(u => u.level = 0);
    state.player.x = 800; state.player.y = 800;
    state.player.speed = state.upgrades.find(u => u.id === 'speed').effect(0);
    state.player.maxPods = state.upgrades.find(u => u.id === 'capacity').effect(0);
    state.camera.x = 0; state.camera.y = 0;
    state.bosses.defeatedThisRun = {}; // clear so bosses can spawn

    initWorld(); updateWorldColors(); updateHUD(); renderUpgrades();
    showBiomeToast('BOSS RUSH', 'Defeat them in order');
    updateBossRushBanner();
    // Spawn first boss
    _bossRushSpawnNext();
    saveGame();
}

function _bossRushSpawnNext() {
    const ru = state._bossRush;
    if (!ru) return;
    const id = ru.queue[ru.current];
    if (!id) { _bossRushVictory(); return; }
    state.level = BOSS_DEFS[id].unlockArea; // makes spawnBossForArea pick the right one
    spawnBossForArea();
}

function onBossRushKillNext() {
    const ru = state._bossRush;
    if (!ru) return;
    ru.current += 1;
    if (ru.current >= ru.queue.length) {
        _bossRushVictory();
    } else {
        setTimeout(() => _bossRushSpawnNext(), 1200);
    }
}

function _bossRushVictory() {
    const ru = state._bossRush;
    if (!ru) return;
    const elapsed = Math.round((Date.now() - ru.startedAt) / 1000);
    const prevBest = state.bossRush.bestTimeSec;
    const newBest = prevBest == null || elapsed < prevBest;
    if (newBest) state.bossRush.bestTimeSec = elapsed;

    // Rewards
    state.starFragments += 25;
    state.sparks += 5;
    updateHUD();
    showAchievementToast({ icon: '👑', name: 'Boss Rush Complete', reward: { motes: 0 } });
    const t = document.getElementById('achievement-toast');
    if (t) {
        t.querySelector('.ach-label').textContent = 'VICTORY';
        t.querySelector('.ach-reward').textContent = `${formatPlayTime(elapsed)}${newBest ? ' · NEW BEST' : ''} · +25 ⭐ +5 ✨`;
        t.style.borderColor = 'var(--neon-gold)';
        setTimeout(() => { t.querySelector('.ach-label').textContent = 'Achievement Unlocked'; t.style.borderColor = ''; }, 5000);
    }

    // Return to main run
    state._bossRush = null;
    updateBossRushBanner();
    if (state.runSnapshots.main) {
        applyRunSnapshot(state.runSnapshots.main);
        updateWorldColors(); updateHUD(); renderUpgrades();
    }
    saveGame();
}

function exitBossRush() {
    if (!isInBossRush()) return;
    state._bossRush = null;
    if (state.activeBoss && state.activeBoss.el) state.activeBoss.el.remove();
    if (state.activeBoss && state.activeBoss.telegraphEl) state.activeBoss.telegraphEl.remove();
    state.activeBoss = null;
    hideBossHpBar();
    if (state.runSnapshots.main) {
        applyRunSnapshot(state.runSnapshots.main);
        updateWorldColors(); updateHUD(); renderUpgrades();
    }
    updateBossRushBanner();
    saveGame();
}

function updateBossRushBanner() {
    const banner = document.getElementById('boss-rush-banner');
    if (!banner) return;
    if (!isInBossRush()) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    const progress = banner.querySelector('.brb-progress');
    if (progress) progress.textContent = `${state._bossRush.current + 1} / ${state._bossRush.queue.length}`;
}
setInterval(updateBossRushBanner, 1000);

// ============================================================
// v3.2 Spirit Codex — collection panel that fills in as you defeat entities
// ============================================================
const CODEX_ENTRIES = {
    spirits: [
        { key: 'glimmer', name: 'Glimmer',  icon: '✦', color: 'neon-cyan',   desc: 'Quick and small, drawn to bright light. Dispels in a single hit.', tip: 'Lead them into your burst radius.' },
        { key: 'creeper', name: 'Creeper',  icon: '◉', color: 'neon-purple', desc: 'Slow and heavy, with eerie patience. Bigger body, harder to dodge.', tip: 'Stuns easily but moves predictably — flank it.' },
        { key: 'flare',   name: 'Solar Flare', icon: '✸', color: 'neon-orange', desc: 'Periodically pulses a heat wave that slows tree regrowth nearby.', tip: 'Dispel quickly before its pulse hits your sources.' },
        { key: 'shade',   name: 'Shade',    icon: '✻', color: 'neon-pink',   desc: 'A creature of fragmenting shadow. Splits into two smaller shreds on death.', tip: 'Burst it near a tether for an instant double-clear.' }
    ],
    bosses: [
        { key: 'spirit_lord',       name: 'The Spirit Lord',  icon: '👁️', color: 'neon-pink',   desc: 'Awakens in the depths of Area 10 to test your resolve.', tip: 'Stay outside the telegraph ring during slams.' },
        { key: 'eclipse_sovereign', name: 'Eclipse Sovereign',icon: '🌑', color: 'neon-gold',   desc: 'Rules the void beyond Area 20. Faster, heavier, more deadly.', tip: 'Bring Spirit Ward and a fleet of sentinels.' }
    ],
    secrets: [
        { key: 'wandering_sage', name: 'Wandering Sage', icon: '🧙', color: 'neon-cyan',   desc: 'A rare traveler who grants a temporary blessing when found.', tip: 'Spawns randomly in worlds — keep your eyes peeled.' },
        { key: 'lost_beacon',    name: 'Lost Beacon',    icon: '🗼', color: 'neon-lime',   desc: 'A forgotten light that automatically connects to your nearest tree.', tip: 'Free tether — saves you star fragments.' },
        { key: 'phoenix_nest',   name: 'Phoenix Nest',   icon: '🪺', color: 'neon-gold',   desc: 'A nest of dormant flame. Touching it grants stars but releases a swarm.', tip: 'Make sure your burst is ready before opening it.' }
    ]
};
state.codex = state.codex || { spirits: {}, bosses: {}, secrets: {} };

function recordCodexEncounter(category, key) {
    if (!state.codex[category]) state.codex[category] = {};
    const rec = state.codex[category][key] || (state.codex[category][key] = { count: 0, firstSeen: null });
    rec.count += 1;
    if (!rec.firstSeen) rec.firstSeen = Date.now();
}

function renderCodex() {
    const body = document.getElementById('codex-body');
    if (!body) return;
    const sections = [
        { id: 'spirits', label: 'Void Spirits',  entries: CODEX_ENTRIES.spirits },
        { id: 'bosses',  label: 'Bosses',        entries: CODEX_ENTRIES.bosses },
        { id: 'secrets', label: 'Hidden Secrets',entries: CODEX_ENTRIES.secrets }
    ];
    body.innerHTML = sections.map(sec => {
        const cards = sec.entries.map(e => {
            const rec = state.codex[sec.id]?.[e.key];
            const unlocked = !!rec;
            const color = `var(--${e.color})`;
            const firstSeen = rec?.firstSeen ? new Date(rec.firstSeen).toLocaleDateString() : '—';
            if (!unlocked) {
                return `<div class="codex-card locked">
                    <div class="codex-icon">?</div>
                    <div class="codex-meta">
                        <div class="codex-name">???</div>
                        <div class="codex-desc">Encounter to reveal.</div>
                    </div>
                </div>`;
            }
            return `<div class="codex-card unlocked" style="border-color: ${color};">
                <div class="codex-icon" style="color: ${color}; text-shadow: 0 0 10px ${color};">${e.icon}</div>
                <div class="codex-meta">
                    <div class="codex-name" style="color: ${color};">${escapeHTML(e.name)}</div>
                    <div class="codex-desc">${escapeHTML(e.desc)}</div>
                    <div class="codex-tip"><strong>Tip:</strong> ${escapeHTML(e.tip)}</div>
                    <div class="codex-stats">Encountered <strong>${rec.count}</strong> ${rec.count === 1 ? 'time' : 'times'} · First seen ${firstSeen}</div>
                </div>
            </div>`;
        }).join('');
        const unlockedCount = sec.entries.filter(e => state.codex[sec.id]?.[e.key]).length;
        return `<div class="codex-section">
            <div class="codex-section-header">
                <span class="codex-section-title">${sec.label}</span>
                <span class="codex-section-progress">${unlockedCount} / ${sec.entries.length}</span>
            </div>
            <div class="codex-grid">${cards}</div>
        </div>`;
    }).join('');
}

// ============================================================
// v3.2 Player Titles — flair earned through milestones, displayed in profile + leaderboard
// ============================================================
const TITLES = [
    // id, name, color (CSS var), condition (returns bool)
    { id: 'wanderer',        name: 'Wanderer',         color: 'text-muted',   check: () => true }, // default
    { id: 'first_bloom',     name: 'First Bloom',      color: 'neon-lime',    check: () => (state.stats?.totalPodsHarvested || 0) >= 50 || state.achievements?.first_pod?.unlocked },
    { id: 'voidwalker',      name: 'Voidwalker',       color: 'neon-purple',  check: () => state.bosses?.defeatedEver?.spirit_lord },
    { id: 'sovereign_slayer',name: 'Sovereign-Slayer', color: 'neon-gold',    check: () => state.bosses?.defeatedEver?.eclipse_sovereign },
    { id: 'transcendent',    name: 'Transcendent',     color: 'neon-purple',  check: () => (state.lifetime?.ascensions || 0) >= 1 },
    { id: 'devotee_7',       name: '7-Day Devotee',    color: 'neon-pink',    check: () => (state.streak?.longest || 0) >= 7 },
    { id: 'devotee_30',      name: '30-Day Devotee',   color: 'neon-gold',    check: () => (state.streak?.longest || 0) >= 30 },
    { id: 'daily_champ',     name: 'Daily Champion',   color: 'neon-cyan',    check: () => Object.keys(state.dailyBest || {}).length >= 5 },
    { id: 'pathfinder',      name: 'Pathfinder',       color: 'neon-cyan',    check: () => (state.runRecords?.highestArea || state.lifetime?.area || 0) >= 5 },
    { id: 'voyager',         name: 'Voyager',          color: 'neon-purple',  check: () => (state.runRecords?.highestArea || state.lifetime?.area || 0) >= 10 },
    { id: 'eternal_wanderer',name: 'Eternal Wanderer', color: 'neon-gold',    check: () => (state.runRecords?.highestArea || state.lifetime?.area || 0) >= 20 },
    { id: 'mote_magnate',    name: 'Mote Magnate',     color: 'neon-lime',    check: () => (state.lifetime?.motes || 0) >= 100000 },
    { id: 'starforged',      name: 'Starforged',       color: 'neon-gold',    check: () => (state.stats?.totalStarsHarvested || 0) >= 25 || state.achievements?.stars_25?.unlocked },
    { id: 'cosmos_touched',  name: 'Cosmos-Touched',   color: 'neon-gold',    check: () => Object.keys(state.sparkUpgrades || {}).some(k => state.sparkUpgrades[k] > 0 && astralUpgrades.find(u => u.id === k)?.tier === 'cosmos') }
];
function isTitleUnlocked(id) {
    const t = TITLES.find(t => t.id === id);
    return !!(t && t.check());
}
function getEquippedTitle() {
    const id = state.profile.title || 'wanderer';
    let t = TITLES.find(t => t.id === id);
    if (!t || !t.check()) t = TITLES[0]; // fallback to default if condition is no longer met
    return t;
}
function renderTitleHTML(t) {
    const color = `var(--${t.color})`;
    return `<span class="player-title" style="color: ${color}; text-shadow: 0 0 6px ${color};">${escapeHTML(t.name)}</span>`;
}

// ============================================================
// v3.1 Daily Streak — counts consecutive UTC days the player loaded the game
// ============================================================
function dayKey(d = new Date()) {
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
// ============================================================
// v3.1 In-run stats popover — pods/sec, motes/sec, ETA
// ============================================================
state._rateTrack = { motes: 0, pods: 0, lastMotes: 0, lastPods: 0, lastT: Date.now(), motesPerSec: 0, podsPerSec: 0 };

function updateRunStatsRates() {
    const now = Date.now();
    const dt = (now - state._rateTrack.lastT) / 1000;
    if (dt < 0.5) return;
    const dMotes = state.stats.totalMotesEarned - state._rateTrack.lastMotes;
    const dPods  = state.stats.totalPodsHarvested - state._rateTrack.lastPods;
    // Exponential moving average for smoothness
    const alpha = Math.min(1, dt / 5); // ~5s smoothing
    state._rateTrack.motesPerSec = state._rateTrack.motesPerSec * (1 - alpha) + (dMotes / dt) * alpha;
    state._rateTrack.podsPerSec  = state._rateTrack.podsPerSec  * (1 - alpha) + (dPods  / dt) * alpha;
    state._rateTrack.lastMotes = state.stats.totalMotesEarned;
    state._rateTrack.lastPods  = state.stats.totalPodsHarvested;
    state._rateTrack.lastT = now;

    const panel = document.getElementById('run-stats-panel');
    if (!panel || panel.style.display === 'none') return;
    const objective = getLevelObjective(state.level);
    const progress  = getObjectiveProgress(objective);
    const remaining = Math.max(0, objective.target - progress);
    let etaStr = '—';
    if (objective.type === 'collect_motes' && state._rateTrack.motesPerSec > 0.1) {
        etaStr = formatPlayTime(remaining / state._rateTrack.motesPerSec);
    } else if (objective.type === 'harvest_pods' && state._rateTrack.podsPerSec > 0.1) {
        etaStr = formatPlayTime(remaining / state._rateTrack.podsPerSec);
    } else if (objective.type === 'buy_upgrades') {
        etaStr = `${objective.target - progress} left`;
    }
    panel.querySelector('.rs-motes').textContent = state._rateTrack.motesPerSec.toFixed(1) + '/s';
    panel.querySelector('.rs-pods').textContent  = state._rateTrack.podsPerSec.toFixed(1) + '/s';
    panel.querySelector('.rs-eta').textContent   = etaStr;
}
setInterval(updateRunStatsRates, 1000);

// ============================================================
// v3.1 Random World Events — dynamic biome-flavored buffs/debuffs
// ============================================================
const WORLD_EVENTS = [
    { id: 'aurora',   name: 'Aurora Boost',   desc: '2× mote gain for 30s',                        durationMs: 30000, color: 'var(--neon-cyan)', icon: '🌈', biomes: 'any',
        apply: () => { state.boosts.active['event_motes2x'] = 30; refreshMultipliers(); },
        clear: () => { delete state.boosts.active['event_motes2x']; refreshMultipliers(); } },
    { id: 'bloom',    name: 'Verdant Bloom',  desc: 'All trees instantly refill + 2× regrowth 30s', durationMs: 30000, color: 'var(--neon-lime)', icon: '🌿', biomes: 'any',
        apply: () => {
            state.entities.forEach(e => { if (e.type === 'tree') { e.pods = (e.subType === 'star-tree') ? 1 : 10; e.boostedUntil = Date.now() + 30000; } });
        },
        clear: () => {} },
    { id: 'moteshower', name: 'Mote Shower',  desc: 'Free motes drift in from the canopy',         durationMs: 20000, color: 'var(--neon-lime)', icon: '💫', biomes: 'any',
        apply: () => { state._moteShowerUntil = Date.now() + 20000; },
        clear: () => {} },
    { id: 'eclipse',  name: 'Void Eclipse',   desc: 'Spirits 3× faster but motes 1.5× this run',   durationMs: 35000, color: 'var(--neon-purple)', icon: '🌑', biomes: 'any',
        apply: () => {
            state._eclipseUntil = Date.now() + 35000;
            state.boosts.active['event_motes15'] = 35;
            // Drain spirit spawn interval
            if (state.spiritIntervalId) clearInterval(state.spiritIntervalId);
            state.spiritIntervalId = setInterval(spawnVoidSpirit, 3500);
            refreshMultipliers();
        },
        clear: () => {
            delete state.boosts.active['event_motes15'];
            refreshMultipliers();
            updateBiome(); // restore normal spawn interval
        } },
    { id: 'glimmer',  name: 'Glimmer Tide',   desc: 'Star trees regrow 4× for 45s',                 durationMs: 45000, color: 'var(--neon-gold)', icon: '🌟', biomes: 'any',
        apply: () => { state._glimmerUntil = Date.now() + 45000; },
        clear: () => {} }
];

let _activeEvent = null;
function pickRandomEvent() {
    if (_activeEvent) return; // one at a time
    const choices = WORLD_EVENTS;
    const ev = choices[Math.floor(Math.random() * choices.length)];
    triggerWorldEvent(ev);
}
function triggerWorldEvent(ev) {
    _activeEvent = { ev, startedAt: Date.now() };
    ev.apply();
    // Announce via achievement toast (reused styling)
    showAchievementToast({ icon: ev.icon, name: ev.name, reward: { motes: 0 } });
    const t = document.getElementById('achievement-toast');
    if (t) {
        t.querySelector('.ach-label').textContent = 'World Event';
        t.querySelector('.ach-reward').textContent = ev.desc;
        t.style.borderColor = ev.color;
    }
    setTimeout(() => {
        const t = document.getElementById('achievement-toast');
        if (t) { t.querySelector('.ach-label').textContent = 'Achievement Unlocked'; t.style.borderColor = ''; }
    }, 4500);
    playTone(440, 'sine', 0.4, 0.3); playTone(660, 'sine', 0.4, 0.3); playTone(880, 'sine', 0.4, 0.4);
    setTimeout(() => {
        ev.clear();
        _activeEvent = null;
    }, ev.durationMs);
}

// Event picker — runs every 90-150s, 60% chance to fire
function _scheduleNextEvent() {
    const delay = 90000 + Math.random() * 60000;
    setTimeout(() => {
        if (Math.random() < 0.6 && state.level >= 2 && !state.dailyMode && state.settings.worldEvents !== false) {
            pickRandomEvent();
        }
        _scheduleNextEvent();
    }, delay);
}
_scheduleNextEvent();

// Mote shower tick — sprinkle motes randomly
setInterval(() => {
    if (!state._moteShowerUntil || Date.now() > state._moteShowerUntil) return;
    const gain = 5 + Math.random() * 10;
    state.motes += gain;
    state.stats.totalMotesEarned += gain;
    state.lifetime.motes = (state.lifetime.motes || 0) + gain;
    // Visual: floating number near player
    showFloatingNumber(state.player.x + (Math.random() - 0.5) * 100, state.player.y - 40, `+${Math.floor(gain)} motes`, { color: 'var(--neon-lime)' });
    updateHUD();
}, 1200);

// Star tree boost during Glimmer Tide
const _origGlimmerCheck = () => state._glimmerUntil && Date.now() < state._glimmerUntil;
window.isGlimmerActive = _origGlimmerCheck;

function tickDailyStreak() {
    const today = dayKey();
    const last = state.streak.lastUTCDay;
    if (last === today) return; // already counted today
    const yesterday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return dayKey(d); })();
    if (last === yesterday) {
        state.streak.current = (state.streak.current || 0) + 1;
    } else if (last == null) {
        state.streak.current = 1; // first ever day
    } else {
        state.streak.current = 1; // missed a day → reset
    }
    state.streak.longest = Math.max(state.streak.longest || 0, state.streak.current);
    state.streak.lastUTCDay = today;

    // Reward thresholds: 3, 7, 14, 30 day streaks award sparks
    const REWARDS = { 3: { sparks: 1 }, 7: { sparks: 3 }, 14: { sparks: 8 }, 30: { sparks: 20 } };
    const r = REWARDS[state.streak.current];
    if (r && !state.streak.rewardsClaimed[state.streak.current]) {
        state.streak.rewardsClaimed[state.streak.current] = true;
        state.sparks += r.sparks;
        showAchievementToast({ icon: '🔥', name: `${state.streak.current}-Day Streak!`, reward: { motes: 0 } });
        const t = document.getElementById('achievement-toast');
        if (t) t.querySelector('.ach-reward').textContent = `+${r.sparks} Eternal Sparks`;
    }
}

function ensureProfileInitialized() {
    if (!state.profile.playerId) state.profile.playerId = generatePlayerId();
    if (!state.profile.joined)   state.profile.joined = Date.now();
    // Generate a themed random name on first-ever profile creation
    if (!state.profile.name)     state.profile.name = generateUsername();
}

function formatPlayTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec % 60}s`;
    return `${sec}s`;
}
function formatNumber(n) {
    n = Math.floor(n);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

// Tick play time every second
setInterval(() => { state.lifetime.playSec = (state.lifetime.playSec || 0) + 1; }, 1000);

function renderProfile() {
    ensureProfileInitialized();

    // Avatar — live layered sprite from equipped cosmetic
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
        const cos = getEquippedCosmetic();
        avatar.innerHTML = SPRITE_TEMPLATES[cos.key] || SPRITE_TEMPLATES.spark;
    }

    // Identity
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) nameInput.value = state.profile.name || 'Wanderer';
    const idDisplay = document.getElementById('profile-id-display');
    if (idDisplay) idDisplay.textContent = state.profile.playerId;

    // Equipped title display
    const titleDisplay = document.getElementById('profile-title-display');
    if (titleDisplay) {
        const t = getEquippedTitle();
        titleDisplay.innerHTML = renderTitleHTML(t);
    }

    // Titles section — render all titles, locked/unlocked/equipped
    const titlesGrid = document.getElementById('profile-titles');
    if (titlesGrid) {
        const equippedId = (getEquippedTitle().id);
        titlesGrid.innerHTML = TITLES.map(t => {
            const unlocked = !!t.check();
            const equipped = equippedId === t.id;
            const color = `var(--${t.color})`;
            return `<button class="title-chip ${unlocked ? 'unlocked' : 'locked'} ${equipped ? 'equipped' : ''}"
                ${unlocked ? `data-title-id="${t.id}"` : 'disabled'}
                style="${unlocked ? `color: ${color}; border-color: ${color};` : ''}">
                ${escapeHTML(t.name)}${equipped ? ' <span class="title-tag">★</span>' : ''}
            </button>`;
        }).join('');
    }

    // Cloud sync indicator
    const cloudIndicator = document.getElementById('profile-cloud-status');
    if (cloudIndicator) {
        if (!isCloudEnabled()) {
            cloudIndicator.className = 'profile-cloud off';
            cloudIndicator.innerHTML = `<span class="dot"></span> Cloud Sync · Not Configured`;
        } else if (CLOUD_STATE.online) {
            const ago = CLOUD_STATE.lastSync ? Math.floor((Date.now() - CLOUD_STATE.lastSync) / 1000) : null;
            cloudIndicator.className = 'profile-cloud online';
            cloudIndicator.innerHTML = `<span class="dot"></span> Cloud Sync · Connected${ago != null ? ` · last ${ago}s ago` : ''}`;
        } else {
            cloudIndicator.className = 'profile-cloud error';
            cloudIndicator.innerHTML = `<span class="dot"></span> Cloud Sync · Error <span class="cloud-err">${escapeHTML(CLOUD_STATE.lastError || 'offline')}</span>`;
        }
    }

    // Lifetime stats grid
    const grid = document.getElementById('profile-stats');
    if (grid) {
        const lt = state.lifetime;
        const highestArea = Math.max(lt.area || 0, state.level || 1);
        const joined = state.profile.joined ? new Date(state.profile.joined).toLocaleDateString() : '—';
        const streakStr = `${state.streak?.current || 0}🔥${state.streak?.longest ? ` (best ${state.streak.longest})` : ''}`;
        const stats = [
            { label: 'Runs',           value: lt.runs || 0 },
            { label: 'Ascensions',     value: lt.ascensions || 0 },
            { label: 'Highest Area',   value: highestArea },
            { label: 'Lifetime Motes', value: formatNumber(lt.motes || 0) },
            { label: 'Play Time',      value: formatPlayTime(lt.playSec || 0) },
            { label: 'Daily Streak',   value: streakStr },
            { label: 'Joined',         value: joined }
        ];
        grid.innerHTML = stats.map(s => `
            <div class="profile-stat">
                <div class="stat-label">${s.label}</div>
                <div class="stat-value">${s.value}</div>
            </div>`).join('');
    }

    // Achievements summary
    const summary = document.getElementById('profile-achievement-summary');
    if (summary) {
        const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id]?.unlocked).length;
        const claimed  = ACHIEVEMENTS.filter(a => state.achievements[a.id]?.claimed).length;
        const total    = ACHIEVEMENTS.length;
        const claimable = unlocked - claimed;
        summary.innerHTML = `
            <div class="pas-icon">🏆</div>
            <div class="pas-text">
                <div class="pas-count">${claimed} / ${total} claimed</div>
                <div class="pas-desc">${claimable > 0 ? `${claimable} ready to claim` : 'All caught up'}</div>
            </div>
            <button class="pas-link" id="pas-open">Open</button>`;
        const btn = document.getElementById('pas-open');
        if (btn) btn.onclick = () => {
            document.getElementById('profile-panel').classList.remove('active');
            renderAchievements();
            document.getElementById('achievements-panel').classList.add('active');
        };
    }
}

// ============================================================
// v3.0 Hub: leaderboard (run records + daily best + stubbed global)
// ============================================================
state.runRecords = state.runRecords || { bestMotes: 0, highestArea: 0, fastestAscendSec: null };

let activeLeaderboardTab = 'run';
function renderLeaderboard() {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeLeaderboardTab));

    if (activeLeaderboardTab === 'run') {
        const r = state.runRecords;
        const rows = [
            { rank: '🏆', name: 'Best Motes (single run)',    score: formatNumber(r.bestMotes || 0) + ' motes' },
            { rank: '🪐', name: 'Highest Area Reached',       score: 'Area ' + (r.highestArea || 1) },
            { rank: '⚡', name: 'Fastest Ascension',          score: r.fastestAscendSec ? formatPlayTime(r.fastestAscendSec) : '—' },
            { rank: '🛡️', name: 'Active Tethers (peak)',      score: String(Math.max(state.tethers?.length || 0, r.peakTethers || 0)) }
        ];
        body.innerHTML = rows.map(row => `
            <div class="lb-row">
                <div class="lb-rank">${row.rank}</div>
                <div class="lb-name">${row.name}</div>
                <div class="lb-score">${row.score}</div>
            </div>`).join('');
        return;
    }
    if (activeLeaderboardTab === 'daily') {
        const entries = Object.entries(state.dailyBest || {})
            .sort((a, b) => b[0] - a[0])    // most recent seeds first
            .slice(0, 30);
        if (entries.length === 0) {
            body.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-icon">🏅</div>
                    <div>No daily runs yet.</div>
                    <div style="margin-top: 8px; font-size: 0.82rem;">Start a Daily Challenge from the Hub to set your first record.</div>
                </div>`;
            return;
        }
        body.innerHTML = entries.map(([seed, rec], i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const seedStr = String(seed);
            const date = `${seedStr.slice(0,4)}-${seedStr.slice(4,6)}-${seedStr.slice(6,8)}`;
            return `
                <div class="lb-row">
                    <div class="lb-rank ${rankClass}">${i + 1}</div>
                    <div class="lb-name">Seed #${seed}<div class="lb-meta">${date} • Area ${rec.level}</div></div>
                    <div class="lb-score">${formatNumber(rec.motes)} motes</div>
                </div>`;
        }).join('');
        return;
    }
    if (activeLeaderboardTab === 'global') {
        if (!isCloudEnabled()) {
            body.innerHTML = `
                <div class="lb-coming-soon">
                    <div class="lb-icon">🌐</div>
                    <h3>Global Leaderboard — Not Configured</h3>
                    <p>Follow <code>SUPABASE_SETUP.md</code> in the project root and paste your <strong>Project URL + anon key</strong> into the <code>CLOUD CONFIG</code> block at the top of <code>src/main.js</code>. The Global tab will light up automatically.</p>
                </div>`;
            return;
        }
        // Loading state
        body.innerHTML = `<div class="lb-empty"><div class="lb-icon">🌐</div><div>Loading global rankings…</div></div>`;
        // Sub-tabs: All-time Runs vs Today's Daily
        const renderRows = (rows, mode) => {
            if (!rows || rows.length === 0) {
                body.innerHTML = `
                    <div class="lb-sub-tabs"><button class="lb-sub active" data-sub="run">Top Runs</button><button class="lb-sub" data-sub="daily">Today's Daily</button></div>
                    <div class="lb-empty">
                        <div class="lb-icon">🌐</div>
                        <div>No global scores yet on ${mode === 'run' ? 'all-time' : 'today\'s seed'}.</div>
                        <div style="margin-top: 8px; font-size: 0.82rem;">Ascend (or finish a daily) to be the first.</div>
                    </div>`;
                wireSubTabs();
                return;
            }
            const myId = state.profile.playerId;
            body.innerHTML = `
                <div class="lb-sub-tabs">
                    <button class="lb-sub ${mode === 'run' ? 'active' : ''}"   data-sub="run">Top Runs</button>
                    <button class="lb-sub ${mode === 'daily' ? 'active' : ''}" data-sub="daily">Today's Daily</button>
                </div>` +
                rows.map((row, i) => {
                    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    const isMe = row.player_id === myId;
                    // If row has a title field, render it; otherwise just show name
                    const titleStr = row.title ? `<div class="lb-title">${escapeHTML(row.title)}</div>` : '';
                    return `
                        <div class="lb-row ${isMe ? 'is-me' : ''}">
                            <div class="lb-rank ${rankClass}">${i + 1}</div>
                            <div class="lb-name">${escapeHTML(row.name)}${isMe ? ' <span class="lb-you">YOU</span>' : ''}${titleStr}<div class="lb-meta">Area ${row.level}${row.seed ? ` • Seed #${row.seed}` : ''}</div></div>
                            <div class="lb-score">${formatNumber(row.score)} motes</div>
                        </div>`;
                }).join('');
            wireSubTabs();
        };
        const wireSubTabs = () => {
            document.querySelectorAll('.lb-sub').forEach(b => {
                b.onclick = () => {
                    const sub = b.dataset.sub;
                    body.innerHTML = `<div class="lb-empty"><div class="lb-icon">🌐</div><div>Loading…</div></div>`;
                    const seed = sub === 'daily' ? String(getTodaySeed()) : '';
                    cloudFetchLeaderboard(sub, seed).then(rows => renderRows(rows, sub));
                };
            });
        };
        // Default: top runs
        cloudFetchLeaderboard('run', '').then(rows => renderRows(rows, 'run'));
    }
}

function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notifyAchievementProgress(_event, _value) {
    let didUnlock = false;
    for (const ach of ACHIEVEMENTS) {
        const rec = state.achievements[ach.id] || (state.achievements[ach.id] = { unlocked: false, claimed: false });
        if (rec.unlocked || rec.claimed) continue; // skip if already unlocked OR claimed
        if (ach.getProgress() >= ach.target) {
            rec.unlocked = true;
            rec.unlockedAt = Date.now();
            showAchievementToast(ach);
            didUnlock = true;
        }
    }
    // Persist immediately so a quick reload doesn't lose unlock state
    if (didUnlock) saveGame();
}

function showAchievementToast(ach) {
    const toast = document.getElementById('achievement-toast');
    if (!toast) return;
    toast.querySelector('.ach-icon').textContent = ach.icon;
    toast.querySelector('.ach-name').textContent = ach.name;
    const r = ach.reward;
    const rewardStr = r.motes ? `+${r.motes} motes` : `+${r.starFragments} ⭐`;
    toast.querySelector('.ach-reward').textContent = `Reward ready: ${rewardStr}`;
    toast.classList.remove('show'); void toast.offsetWidth;
    toast.classList.add('show');
    playLevelUpSound();
    setTimeout(() => toast.classList.remove('show'), 4200);
}

function claimAchievement(id) {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    const rec = state.achievements[id];
    if (!ach || !rec || !rec.unlocked || rec.claimed) return;
    rec.claimed = true;
    if (ach.reward.motes) {
        state.motes += ach.reward.motes;
        state.stats.totalMotesEarned += ach.reward.motes;
    }
    if (ach.reward.starFragments) {
        state.starFragments += ach.reward.starFragments;
    }
    playTone(800, 'sine', 0.5, 0.3);
    updateHUD();
    renderAchievements();
    saveGame();
}

function renderAchievements() {
    const list = document.getElementById('achievement-list');
    if (!list) return;
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const rec = state.achievements[ach.id] || { unlocked: false, claimed: false };
        const progress = Math.min(ach.getProgress(), ach.target);
        const pct = Math.floor((progress / ach.target) * 100);
        const row = document.createElement('div');
        row.className = `achievement-row ${rec.unlocked ? 'unlocked' : 'locked'}`;
        const r = ach.reward;
        const rewardStr = r.motes ? `+${r.motes} ✨` : `+${r.starFragments} ⭐`;
        let rewardEl;
        if (rec.claimed)       rewardEl = `<span class="ar-reward claimed">Claimed</span>`;
        else if (rec.unlocked) rewardEl = `<button class="ar-reward claimable" data-id="${ach.id}">${rewardStr}</button>`;
        else                   rewardEl = `<span class="ar-reward">${rewardStr}</span>`;

        row.innerHTML = `
            <div class="ar-icon">${ach.icon}</div>
            <div class="ar-text">
                <div class="ar-name">${ach.name}</div>
                <div class="ar-desc">${ach.desc}</div>
                <div class="ar-progress"><div class="ar-fill" style="width: ${pct}%"></div></div>
            </div>
            ${rewardEl}`;
        list.appendChild(row);
    });
}

// v3.0: Accessibility — apply settings to <body> class list
function applyAccessibility() {
    const body = document.body;
    body.classList.toggle('reduced-motion', !!state.settings.reducedMotion);
    body.classList.toggle('performance-mode', !!state.settings.performanceMode);
    body.classList.remove('cb-deuteranopia', 'cb-protanopia', 'cb-tritanopia');
    const cb = state.settings.colorblind;
    if (cb && cb !== 'off') body.classList.add(`cb-${cb}`);
    // Camera zoom — apply to game world scale
    const z = state.settings.cameraZoom || 1;
    const world = document.getElementById('game-world');
    if (world) world.style.setProperty('--world-scale', z);
}

// v3.0: Floating gain numbers (anchored in game-world coordinates)
function showFloatingNumber(x, y, text, opts = {}) {
    if (!state.settings.showParticles) return;
    const el = document.createElement('div');
    el.className = 'float-num' + (opts.crit ? ' crit' : '');
    el.textContent = text;
    if (!opts.crit && opts.color) el.style.color = opts.color;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, 0)';
    entitiesLayer.appendChild(el);
    if (opts.crit) {
        // CSS animation handles it
        setTimeout(() => el.remove(), 1000);
    } else {
        const dx = (Math.random() - 0.5) * 30;
        el.animate(
            [
                { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
                { transform: `translate(calc(-50% + ${dx * 0.4}px), -16px) scale(1.15)`, opacity: 1, offset: 0.2 },
                { transform: `translate(calc(-50% + ${dx}px), -52px) scale(1)`, opacity: 0 }
            ],
            { duration: 850, easing: 'ease-out' }
        ).onfinish = () => el.remove();
    }
}

// v3.0: Accumulator for floating sell numbers (avoids spam at 60fps)
const sellAccum = { motes: 0, lastFlush: 0 };

// v3.0: Player movement trail particles
let trailFrameCounter = 0;
let trailLastX = 0, trailLastY = 0;
function emitPlayerTrail() {
    if (!state.settings.showParticles || state.settings.reducedMotion) return;
    const dx = state.player.x - trailLastX;
    const dy = state.player.y - trailLastY;
    if (dx * dx + dy * dy < 4) return; // only when actually moving
    if (++trailFrameCounter % 4 !== 0) return; // throttle
    trailLastX = state.player.x;
    trailLastY = state.player.y;

    const t = document.createElement('div');
    t.className = 'trail-particle';
    t.style.left = `${state.player.x - 4}px`;
    t.style.top = `${state.player.y - 4}px`;
    // Tint by equipped cosmetic for variety
    const cos = getEquippedCosmetic && getEquippedCosmetic();
    const palette = { spark: '0,242,255', faerie: '188,0,255', sprite: '255,215,0', lantern: '255,157,0' };
    const rgb = palette[cos?.key] || '0,242,255';
    t.style.background = `radial-gradient(circle, rgba(${rgb}, 0.85) 0%, transparent 70%)`;
    entitiesLayer.appendChild(t);
    t.animate(
        [
            { transform: 'scale(1)',   opacity: 0.75 },
            { transform: 'scale(0.3)', opacity: 0 }
        ],
        { duration: 700, easing: 'ease-out' }
    ).onfinish = () => t.remove();
}

// v3.0: Format upgrade effect values for tooltip display
function formatUpgradeEffect(upgrade, lvl) {
    const v = upgrade.effect(lvl);
    switch (upgrade.id) {
        case 'speed':       return v.toFixed(1);
        case 'harvest':     return Math.round(v) + ' range';
        case 'capacity':    return Math.floor(v) + ' pods';
        case 'forge_speed': return v.toFixed(2) + '/tick';
        case 'regrowth':    return (v * 1000).toFixed(1) + '‰';
        case 'wisp':        return v + ' wisp' + (v === 1 ? '' : 's');
        case 'mote_magnet': return Math.round(v) + ' radius';
        case 'crit_harvest':return Math.round(v * 100) + '% crit';
        case 'light_weaver':return v + ' tether' + (v === 1 ? '' : 's');
        case 'star_blessing':return '×' + v.toFixed(1) + ' motes';
        case 'sentinel':    return v + ' sentinel' + (v === 1 ? '' : 's');
        default:            return String(v);
    }
}

// v3.0: Layered DOM sprite templates (replaces flat emojis on the player + cosmetic cards)
const SPRITE_TEMPLATES = {
    spark: `
        <div class="sprite-art sprite-spark">
            <div class="spark-halo"></div>
            <div class="spark-ray h"></div>
            <div class="spark-ray v"></div>
            <div class="spark-ray d1"></div>
            <div class="spark-ray d2"></div>
            <div class="spark-core"></div>
        </div>`,
    faerie: `
        <div class="sprite-art sprite-faerie">
            <div class="faerie-glow"></div>
            <div class="faerie-wing wing-tl"></div>
            <div class="faerie-wing wing-tr"></div>
            <div class="faerie-wing wing-bl"></div>
            <div class="faerie-wing wing-br"></div>
            <div class="faerie-body"></div>
            <div class="faerie-antennae"></div>
        </div>`,
    sprite: `
        <div class="sprite-art sprite-sprite">
            <div class="sprite-glow"></div>
            <div class="sprite-halo-ring"></div>
            <div class="sprite-wing left"></div>
            <div class="sprite-wing right"></div>
            <div class="sprite-body"></div>
            <div class="sprite-head"></div>
            <div class="sprite-dust d1"></div>
            <div class="sprite-dust d2"></div>
            <div class="sprite-dust d3"></div>
        </div>`,
    lantern: `
        <div class="sprite-art sprite-lantern">
            <div class="lantern-glow"></div>
            <div class="lantern-rope"></div>
            <div class="lantern-cap"></div>
            <div class="lantern-body">
                <div class="lantern-rib r1"></div>
                <div class="lantern-rib r2"></div>
                <div class="lantern-rib r3"></div>
                <div class="lantern-flame"></div>
            </div>
            <div class="lantern-base"></div>
            <div class="lantern-tassel"></div>
        </div>`,
    // v3.1 new cosmetics
    orbwisp: `
        <div class="sprite-art sprite-orbwisp">
            <div class="ow-glow"></div>
            <div class="ow-tail t3"></div>
            <div class="ow-tail t2"></div>
            <div class="ow-tail t1"></div>
            <div class="ow-orb"></div>
            <div class="ow-core"></div>
        </div>`,
    phoenix: `
        <div class="sprite-art sprite-phoenix">
            <div class="ph-glow"></div>
            <div class="ph-wing left"></div>
            <div class="ph-wing right"></div>
            <div class="ph-body"></div>
            <div class="ph-tail t1"></div>
            <div class="ph-tail t2"></div>
            <div class="ph-tail t3"></div>
            <div class="ph-eye"></div>
        </div>`,
    moth: `
        <div class="sprite-art sprite-moth">
            <div class="mt-glow"></div>
            <div class="mt-wing-upper left"></div>
            <div class="mt-wing-upper right"></div>
            <div class="mt-wing-lower left"></div>
            <div class="mt-wing-lower right"></div>
            <div class="mt-eye left"></div>
            <div class="mt-eye right"></div>
            <div class="mt-body"></div>
            <div class="mt-antenna left"></div>
            <div class="mt-antenna right"></div>
        </div>`,
    lotus: `
        <div class="sprite-art sprite-lotus">
            <div class="lt-glow"></div>
            <div class="lt-petal p1"></div>
            <div class="lt-petal p2"></div>
            <div class="lt-petal p3"></div>
            <div class="lt-petal p4"></div>
            <div class="lt-petal p5"></div>
            <div class="lt-inner i1"></div>
            <div class="lt-inner i2"></div>
            <div class="lt-inner i3"></div>
            <div class="lt-core"></div>
        </div>`,
    voidcrown: `
        <div class="sprite-art sprite-voidcrown">
            <div class="vc-glow"></div>
            <div class="vc-band"></div>
            <div class="vc-spike s1"></div>
            <div class="vc-spike s2"></div>
            <div class="vc-spike s3"></div>
            <div class="vc-spike s4"></div>
            <div class="vc-spike s5"></div>
            <div class="vc-gem"></div>
            <div class="vc-rune"></div>
        </div>`,
    sovereign_crown: `
        <div class="sprite-art sprite-sovereign">
            <div class="sc-glow"></div>
            <div class="sc-band"></div>
            <div class="sc-spike s1"></div>
            <div class="sc-spike s2"></div>
            <div class="sc-spike s3"></div>
            <div class="sc-spike s4"></div>
            <div class="sc-spike s5"></div>
            <div class="sc-gem g1"></div>
            <div class="sc-gem g2"></div>
            <div class="sc-gem g3"></div>
            <div class="sc-core"></div>
        </div>`
};

function getEquippedCosmetic() {
    // Resolve by stored emoji (state.player.sprite) for save back-compat
    return state.cosmetics.find(c => c.icon === state.player.sprite) || state.cosmetics[0];
}

function renderPlayerSprite() {
    const cos = getEquippedCosmetic();
    const key = cos.key || 'spark';
    const el = document.querySelector('.char-sprite');
    if (!el) return;
    if (el.dataset.spriteKey === key) return;
    el.dataset.spriteKey = key;
    el.innerHTML = SPRITE_TEMPLATES[key] || SPRITE_TEMPLATES.spark;
}

function renderEntity(entity) {
    // v3.0: richly layered DOM art per entity type (no longer plain emojis on a div)
    const el = document.createElement('div');
    el.id = entity.id;
    el.className = entity.type === 'tree' ? 'source-tree v3' : 'light-forge v3';

    const offset = entity.type === 'tree' ? 40 : (entity.type === 'obstacle' ? 0 : 60);
    el.style.left = entity.type === 'obstacle' ? `${entity.x}px` : `${entity.x - offset}px`;
    el.style.top = entity.type === 'obstacle' ? `${entity.y}px` : `${entity.y - offset}px`;

    if (entity.type === 'tree') {
        if (entity.subType === 'star-tree') {
            // Crystalline star tree: rotating halo + faceted crystal core + drifting motes
            el.innerHTML = `
                <div class="star-tree-aura"></div>
                <div class="star-tree-ring r1"></div>
                <div class="star-tree-ring r2"></div>
                <div class="star-crystal">
                    <div class="crystal-facet f1"></div>
                    <div class="crystal-facet f2"></div>
                    <div class="crystal-facet f3"></div>
                    <div class="crystal-core"></div>
                </div>
                <div class="star-spark s1"></div>
                <div class="star-spark s2"></div>
                <div class="star-spark s3"></div>`;
        } else {
            // Layered bioluminescent tree: glow halo, canopy gradient, swaying highlight, trunk
            el.innerHTML = `
                <div class="tree-aura"></div>
                <div class="tree-canopy">
                    <div class="canopy-layer l1"></div>
                    <div class="canopy-layer l2"></div>
                    <div class="canopy-layer l3"></div>
                    <div class="canopy-shine"></div>
                </div>
                <div class="tree-trunk"></div>
                <div class="tree-firefly f1"></div>
                <div class="tree-firefly f2"></div>`;
        }
    } else if (entity.type === 'shrine') {
        // Ancient shrine: floating arches with inner rune light
        el.innerHTML = `
            <div class="shrine-aura"></div>
            <div class="shrine-arch outer"></div>
            <div class="shrine-arch inner"></div>
            <div class="shrine-rune"></div>
            <div class="shrine-base"></div>`;
    } else if (entity.type === 'obstacle') {
        el.className += ` obstacle-${entity.subType} v3`;
        if (entity.subType === 'rock') {
            el.innerHTML = `<div class="rock-shape"><div class="rock-shine"></div></div>`;
        } else {
            el.innerHTML = `<div class="vine-leaf v1"></div><div class="vine-leaf v2"></div><div class="vine-leaf v3"></div>`;
        }
    } else if (entity.type === 'secret') {
        const def = SECRET_DEFS[entity.defKey];
        el.className = `secret secret-${entity.defKey}`;
        el.style.left = `${entity.x - 30}px`;
        el.style.top  = `${entity.y - 30}px`;
        el.innerHTML = `
            <div class="secret-aura"></div>
            <div class="secret-ring"></div>
            <div class="secret-icon">${def?.icon || '?'}</div>`;
    } else {
        // Forge: multi-ring rotating core with pulse aura and label
        el.innerHTML = `
            <div class="forge-aura"></div>
            <div class="forge-ring outer"></div>
            <div class="forge-ring mid"></div>
            <div class="forge-ring inner"></div>
            <div class="forge-core"></div>
            <div class="forge-spark fs1"></div>
            <div class="forge-spark fs2"></div>
            <div class="forge-spark fs3"></div>
            <div class="forge-label">LIGHT FORGE</div>`;
    }
    entitiesLayer.appendChild(el);
}

function handleJoystickStart(e) {
    if (e.target.closest('.hud, .actions, .overlay, .close-btn, #objective-tracker, #burst-zone')) return;
    // In build mode, taps on tetherable trees are tether clicks, not movement
    if (state.buildMode.active && e.target.closest('.source-tree.tetherable')) return;
    const touch = e.touches ? e.touches[0] : e;

    // Dual-Zone: Left half for movement, Bottom-Right corner for burst
    if (touch.clientX > window.innerWidth * 0.7 && touch.clientY > window.innerHeight * 0.7) {
        triggerBurst();
        return;
    }

    state.joystick.active = true;
    state.joystick.startX = touch.clientX;
    state.joystick.startY = touch.clientY;

    const zone = document.getElementById('joystick-zone');
    zone.style.left = `${state.joystick.startX}px`;
    zone.style.top = `${state.joystick.startY}px`;
    zone.classList.add('active');
}

function handleJoystickMove(e) {
    if (!state.joystick.active) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - state.joystick.startX;
    const dy = touch.clientY - state.joystick.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) { // Deadzone
        state.joystick.vector.x = 0; state.joystick.vector.y = 0;
        joystickStick.style.transform = `translate(-50%, -50%)`;
        return;
    }

    const moveDist = Math.min(dist, 50);
    const angle = Math.atan2(dy, dx);
    state.joystick.moveX = Math.cos(angle) * moveDist;
    state.joystick.moveY = Math.sin(angle) * moveDist;
    state.joystick.vector.x = state.joystick.moveX / 50;
    state.joystick.vector.y = state.joystick.moveY / 50;

    joystickStick.style.transform = `translate(calc(-50% + ${state.joystick.moveX}px), calc(-50% + ${state.joystick.moveY}px))`;
}

function handleJoystickEnd() {
    state.joystick.active = false;
    state.joystick.vector = { x: 0, y: 0 };
    joystickStick.style.transform = 'translate(-50%, -50%)';
    document.getElementById('joystick-zone').classList.remove('active');
}

function handleKeyDown(e) {
    if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = true;
    if (e.key === 'Escape') {
        document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
        settingsMsg.textContent = '';
    }
    if (e.key === ' ' || e.key === 'Enter') {
        triggerBurst();
    }
    // v3.1 Active abilities
    const k = e.key.toLowerCase();
    if (k === 'q') triggerAbility('dash');
    if (k === 'e') triggerAbility('pulse');
    if (k === 'r') triggerAbility('ward');
}
function handleKeyUp(e) { if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = false; }

function getKeyboardVector() {
    let vx = 0, vy = 0;
    if (state.keys.w || state.keys.ArrowUp) vy -= 1;
    if (state.keys.s || state.keys.ArrowDown) vy += 1;
    if (state.keys.a || state.keys.ArrowLeft) vx -= 1;
    if (state.keys.d || state.keys.ArrowRight) vx += 1;

    if (vx !== 0 && vy !== 0) {
        const length = Math.sqrt(vx * vx + vy * vy);
        vx /= length; vy /= length;
    }
    return { x: vx, y: vy };
}

function update() {
    // Pause game loop if Astral Forge is open
    if (astralPanel && astralPanel.classList.contains('active')) {
        requestAnimationFrame(update);
        return;
    }

    const kbVector = getKeyboardVector();
    const finalVector = {
        x: state.joystick.active ? state.joystick.vector.x : kbVector.x,
        y: state.joystick.active ? state.joystick.vector.y : kbVector.y
    };

    const currentSpeed = state.player.speed * (state.buffs.active ? 2.0 : 1.0) * state.boosts.speedMultiplier;

    let newX = state.player.x + finalVector.x * currentSpeed;
    let newY = state.player.y + finalVector.y * currentSpeed;
    newX = Math.max(0, Math.min(state.world.width, newX));
    newY = Math.max(0, Math.min(state.world.height, newY));

    let canMoveX = true;
    let canMoveY = true;
    for (const entity of state.entities) {
        if (entity.type === 'obstacle') {
            const distX = Math.sqrt(Math.pow(entity.x - newX, 2) + Math.pow(entity.y - state.player.y, 2));
            if (distX < state.player.radius + entity.radius - 5) canMoveX = false;

            const distY = Math.sqrt(Math.pow(entity.x - state.player.x, 2) + Math.pow(entity.y - newY, 2));
            if (distY < state.player.radius + entity.radius - 5) canMoveY = false;
        }
    }

    if (canMoveX) state.player.x = newX;
    if (canMoveY) state.player.y = newY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    state.camera.x += (centerX - state.player.x - state.camera.x) * state.camera.lerp;
    state.camera.y += (centerY - state.player.y - state.camera.y) * state.camera.lerp;

    playerEl.style.transform = `translate(${state.player.x - 20}px, ${state.player.y - 20}px)`;
    const zoom = state.settings.cameraZoom || 1;
    gameWorld.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${zoom})`;

    // v3.0: Render layered cosmetic sprite (replaces emoji textContent swap)
    renderPlayerSprite();

    emitPlayerTrail();
    checkInteractions();
    updateWisps();
    updateMinimap();
    updateSpirits();
    updateRemnants();
    updateCompanions();
    updateBoss();

    if (state.burst.cooldown > 0) {
        state.burst.cooldown--;
        updateBurstUI();
    }
    updateAbilityButtons();

    updateCombo();
    updatePlayerGlow();
    updateAmbient();

    requestAnimationFrame(update);
}

let lastAmbientTime = 0;
function updateAmbient() {
    if (!audioCtx || !state.settings.volume) return;
    const now = Date.now();
    if (now - lastAmbientTime < 5000 + Math.random() * 10000) return;
    lastAmbientTime = now;

    const frequencies = [220, 293, 329, 440, 587]; // Bioluminescent tones
    const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
    playTone(freq, 'sine', 0.2, 3.0, false); // Long, soft fade
}

function triggerShake() {
    if (!state.settings.screenshake) return;
    const viewport = document.querySelector('.world-viewport');
    if (!viewport) return;
    viewport.classList.add('shake');
    setTimeout(() => viewport.classList.remove('shake'), 300);
}

function updatePlayerGlow() {
    let color = 'rgba(0, 242, 255, 0.3)'; // Default cyan
    if (state.boosts.active['mote_2x']) color = 'rgba(162, 255, 0, 0.4)'; // Lime
    if (state.boosts.active['speed_1.5x']) color = 'rgba(255, 0, 123, 0.4)'; // Pink/Orange
    if (state.combo.frenzy) color = 'rgba(255, 157, 0, 0.6)'; // Gold/Orange

    const glowEl = document.querySelector('.char-glow');
    if (glowEl) {
        glowEl.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
    }
}

function updateCombo() {
    if (state.combo.timer > 0) {
        state.combo.timer--;
        const pct = (state.combo.timer / state.combo.maxTimer) * 100;
        if (comboFill) comboFill.style.width = `${pct}%`;

        if (state.combo.timer <= 0) {
            resetCombo();
        }
    }

    if (state.combo.count > 0) {
        comboContainer.style.display = 'flex';
        comboMultiplier.innerText = `${state.combo.multiplier.toFixed(1)}x`;
    } else {
        comboContainer.style.display = 'none';
    }
}

function addCombo() {
    state.combo.count++;
    state.combo.timer = state.combo.maxTimer;

    // Multiplier scales with count up to 5x
    state.combo.multiplier = 1 + (Math.min(state.combo.count, 40) / 10);

    if (state.combo.count >= 20 && !state.combo.frenzy) {
        state.combo.frenzy = true;
        frenzyIndicator.style.display = 'block';
        triggerShake();
    }
}

function resetCombo() {
    state.combo.count = 0;
    state.combo.multiplier = 1;
    state.combo.frenzy = false;
    frenzyIndicator.style.display = 'none';
}

function checkInteractions() {
    const range = state.upgrades.find(u => u.id === 'harvest').effect(state.upgrades.find(u => u.id === 'harvest').level);
    const regrowthRate = state.upgrades.find(u => u.id === 'regrowth').effect(state.upgrades.find(u => u.id === 'regrowth').level);
    const forgeSellRate = state.upgrades.find(u => u.id === 'forge_speed').effect(state.upgrades.find(u => u.id === 'forge_speed').level);

    state.entities.forEach(entity => {
        const el = document.getElementById(entity.id);
        if (!el) return;

        const dist = Math.sqrt(Math.pow(entity.x - state.player.x, 2) + Math.pow(entity.y - state.player.y, 2));

        if (entity.type === 'tree') {
            const maxCapacity = entity.subType === 'star-tree' ? 1 : 10;
            const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
            const activeThreshold = thresholds.find(t => state.level >= t) || 1;
            const biome = biomes[activeThreshold];
            const regrowthBonus = 1 + (state.sparkUpgrades.starlight_harvest ? 0.2 : 0);

            if (entity.pods < maxCapacity && dist >= range) {
                // Fix: Separate star tree regrowth from normal pods
                if (entity.subType === 'star-tree') {
                    // Star fragments regrow much slower and aren't tied to normal regrowth rate
                    const glimmer = (state._glimmerUntil && Date.now() < state._glimmerUntil) ? 4 : 1;
                    entity.pods = Math.min(maxCapacity, entity.pods + 0.0001 * regrowthBonus * glimmer);
                } else {
                    let rate = regrowthRate * regrowthBonus * biome.regrowth;
                    if (entity.slowedUntil && Date.now() < entity.slowedUntil) {
                        rate *= 0.2; // Solar Flare slow
                    }
                    if (entity.boostedUntil && Date.now() < entity.boostedUntil) {
                        rate *= 3.5; // Chrono-Pulse boost
                    }
                    entity.pods = Math.min(maxCapacity, entity.pods + rate);
                }
            }

            if (dist < range) {
                if (entity.subType === 'star-tree' && entity.pods > 0) {
                    entity.pods -= 1;
                    state.starFragments += 1;
                    state.stats.totalStarsHarvested += 1;
                    el.style.filter = `drop-shadow(0 0 20px var(--neon-gold))`;
                    el.style.transform = `scale(1.2)`;
                    createHarvestParticle(entity.x, entity.y, true);
                    showFloatingNumber(entity.x, entity.y - 30, '+1 ⭐', { crit: true });
                    playHarvestSound();
                    addCombo();
                    triggerShake();
                    updateHUD('stars');
                    notifyAchievementProgress('stars_harvested');
                    updateHUD();
                } else if (entity.subType !== 'star-tree' && entity.pods > 0 && state.pods < state.player.maxPods) {
                    let harvestBase = 0.1 * state.combo.multiplier;
                    if (state.combo.frenzy) harvestBase *= 1.5;

                    const amount = Math.min(harvestBase, entity.pods, state.player.maxPods - state.pods);
                    const critChance = state.upgrades.find(u => u.id === 'crit_harvest').effect(state.upgrades.find(u => u.id === 'crit_harvest').level);
                    const isCrit = Math.random() < critChance;
                    const harvestTotal = isCrit ? amount * 2 : amount;

                    entity.pods -= amount;
                    state.pods += harvestTotal;
                    state.stats.totalPodsHarvested += harvestTotal; // Track stat
                    el.style.filter = `drop-shadow(0 0 20px var(--neon-cyan))`;
                    el.style.transform = `scale(1.1)`;
                    if (Math.random() > 0.90) createHarvestParticle(entity.x, entity.y);
                    if (Math.random() > 0.8) {
                        playHarvestSound();
                        addCombo();
                    }
                    if (isCrit) {
                        showFloatingNumber(entity.x, entity.y - 30, `CRIT ×2`, { crit: true });
                        triggerShake();
                    }
                    updateHUD('pods');
                    updateHUD();
                    notifyAchievementProgress('pods_harvested');
                } else {
                    el.style.filter = ''; el.style.transform = `scale(1)`;
                }
            } else {
                el.style.filter = ''; el.style.transform = `scale(1)`;
            }
            el.style.opacity = Math.max(0.2, entity.pods / maxCapacity);

        } else if (entity.type === 'forge') {
            if (dist < 120) {
                el.style.filter = `drop-shadow(0 0 30px var(--neon-lime))`;
                el.style.transform = `scale(1.05)`;
                if (state.pods > 0) {
                    const sellAmount = Math.min(forgeSellRate, state.pods);
                    const moteMultiplier = state.upgrades.find(u => u.id === 'star_blessing').effect(state.upgrades.find(u => u.id === 'star_blessing').level);
                    const buffMulti = state.buffs.active ? 2 : 1;
                    const sparkMulti = 1 + (state.sparks * 0.1) + (state.sparkUpgrades.astral_attunement ? 0.2 : 0) + (state.sparkUpgrades.cosmic_bloom ? 0.5 : 0);

                    state.pods -= sellAmount;
                    const gained = sellAmount * moteMultiplier * buffMulti * sparkMulti * state.boosts.moteMultiplier;
                    state.motes += gained;
                    state.stats.totalMotesEarned += gained;
                    state.lifetime.motes = (state.lifetime.motes || 0) + gained;
                    // Best-single-run motes record
                    if (state.stats.totalMotesEarned > (state.runRecords.bestMotes || 0)) {
                        state.runRecords.bestMotes = state.stats.totalMotesEarned;
                    }

                    if (Math.random() > 0.70) createSellParticle(state.player.x, state.player.y, entity.x, entity.y);
                    if (Math.random() > 0.5) playSellSound(); // Reduce frequency

                    // v3.0: accumulate motes and emit a floating number periodically
                    sellAccum.motes += gained;
                    if (Date.now() - sellAccum.lastFlush > 350 && sellAccum.motes >= 1) {
                        showFloatingNumber(entity.x, entity.y - 50, `+${Math.floor(sellAccum.motes)} motes`, { color: 'var(--neon-lime)' });
                        sellAccum.motes = 0;
                        sellAccum.lastFlush = Date.now();
                    }
                    updateHUD();
                    notifyAchievementProgress('motes_earned');
                }
            } else {
                el.style.filter = ''; el.style.transform = `scale(1)`;
            }
        } else if (entity.type === 'secret') {
            if (dist < 60) {
                tryInteractSecret(entity);
            }
        } else if (entity.type === 'shrine') {
            if (dist < 80) {
                // Activate buff
                state.buffs.active = true;
                state.buffs.timer = 60; // 60 seconds
                playLevelUpSound();

                // Remove shrine
                el.remove();
                const mapDot = document.getElementById(`map-${entity.id}`);
                if (mapDot) mapDot.remove();
                state.entities = state.entities.filter(e => e.id !== entity.id);
                updateHUD();
            }
        }
    });
}

let wispElements = [];
function updateWisps() {
    const wispLevel = state.upgrades.find(u => u.id === 'wisp').level;

    // Create new DOM elements if level increased
    while (wispElements.length < wispLevel) {
        const w = document.createElement('div');
        w.className = 'pet-wisp';
        entitiesLayer.appendChild(w);
        wispElements.push(w);
    }

    const time = Date.now() * 0.002;
    wispElements.forEach((w, i) => {
        const angle = time + (i * (Math.PI * 2 / wispElements.length));
        const radius = 40;
        const wx = state.player.x + Math.cos(angle) * radius;
        const wy = state.player.y + Math.sin(angle) * radius;
        w.style.transform = `translate(${wx}px, ${wy}px)`;
    });
}

function wispAutoHarvest() {
    const wispLevel = state.upgrades.find(u => u.id === 'wisp').level;
    if (wispLevel === 0) return;

    const range = state.upgrades.find(u => u.id === 'harvest').effect(state.upgrades.find(u => u.id === 'harvest').level) * 1.5; // Slightly larger range

    let podsHarvested = 0;
    state.entities.forEach(entity => {
        if (entity.type === 'tree' && entity.pods > 0.5 && podsHarvested < wispLevel) {
            if (entity.subType === 'star-tree') return; // Wisps ignore star trees

            if (state.pods < state.player.maxPods) {
                const dist = Math.sqrt(Math.pow(entity.x - state.player.x, 2) + Math.pow(entity.y - state.player.y, 2));
                if (dist < range) {
                    const amount = Math.min(0.5, entity.pods, state.player.maxPods - state.pods, wispLevel - podsHarvested);
                    if (amount > 0) {
                        entity.pods -= amount;
                        state.pods += amount;
                        state.stats.totalPodsHarvested += amount;
                        podsHarvested += amount;
                        createHarvestParticle(entity.x, entity.y);
                    }
                }
            }
        }
    });
    if (podsHarvested > 0) {
        if (Math.random() > 0.5) playHarvestSound();
        updateHUD();
    }
}
setInterval(wispAutoHarvest, 1000);

function createHarvestParticle(x, y, isStar = false) {
    if (!state.settings.showParticles) return;
    const p = document.createElement('div');
    p.className = 'harvest-particle';
    p.innerHTML = isStar ? '🌟' : '✨';
    if (isStar) {
        p.style.color = 'var(--neon-gold)';
        p.style.textShadow = '0 0 10px var(--neon-gold)';
    }
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    entitiesLayer.appendChild(p);
    p.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 100}px, ${-100 - Math.random() * 50}px) scale(0)`, opacity: 0 }], { duration: 1000, easing: 'ease-out' }).onfinish = () => p.remove();
}

function createSellParticle(startX, startY, targetX, targetY) {
    const p = document.createElement('div');
    p.className = 'sell-particle'; p.innerHTML = '✨';
    p.style.left = `${startX}px`; p.style.top = `${startY}px`;
    entitiesLayer.appendChild(p);
    const midX = (startX + targetX) / 2 + (Math.random() - 0.5) * 150;
    const midY = (startY + targetY) / 2 + (Math.random() - 0.5) * 150;
    p.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1.3)`, opacity: 0.8, offset: 0.5 }, { transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0)`, opacity: 0 }], { duration: 500 + Math.random() * 300, easing: 'ease-in-out' }).onfinish = () => p.remove();
}

function renderTethers() {
    if (!svgLayer) return;
    svgLayer.innerHTML = '';

    // Ensure map is current
    updateEntityMap();

    state.tethers.forEach(t => {
        const src = state.entityMap[t.sourceId];
        const tgt = state.entityMap[t.targetId];
        if (src && tgt) {
            // Cache coordinates for $O(1)$ collision checks
            t.x1 = src.x; t.y1 = src.y;
            t.x2 = tgt.x; t.y2 = tgt.y;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', t.x1);
            line.setAttribute('y1', t.y1);
            line.setAttribute('x2', t.x2);
            line.setAttribute('y2', t.y2);

            // Visual feedback for health
            const healthPct = (t.health / t.maxHealth);
            line.style.stroke = healthPct < 0.3 ? '#ff4444' : (healthPct < 0.6 ? '#ffaa00' : 'var(--neon-cyan)');
            line.style.strokeWidth = 2;
            line.style.opacity = 0.3 + (healthPct * 0.5);
            if (healthPct < 0.3) line.classList.add('glitch');

            svgLayer.appendChild(line);
        }
    });

    state.remnants.forEach(r => {
        const src = state.entityMap[r.sourceId];
        const tgt = state.entityMap[r.targetId];
        if (src && tgt) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', src.x);
            line.setAttribute('y1', src.y);
            line.setAttribute('x2', tgt.x);
            line.setAttribute('y2', tgt.y);

            line.style.stroke = 'rgba(255, 255, 255, 0.2)';
            line.style.strokeWidth = 1;
            line.style.strokeDasharray = '5,5';
            line.style.opacity = 0.5;

            svgLayer.appendChild(line);

            // Add a small pulse at the source tree to indicate recovery is possible
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', src.x);
            circle.setAttribute('cy', src.y);
            circle.setAttribute('r', 15);
            circle.style.fill = 'none';
            circle.style.stroke = 'var(--neon-gold)';
            circle.style.strokeWidth = 2;
            circle.style.opacity = 0.6;
            circle.classList.add('remnant-pulse');
            svgLayer.appendChild(circle);
        }
    });
}

function tetherHarvest() {
    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    if (weaverLevel === 0 || state.tethers.length === 0) return;

    let totalHarvested = 0;
    const moteMultiplier = state.upgrades.find(u => u.id === 'star_blessing').effect(state.upgrades.find(u => u.id === 'star_blessing').level);
    const buffMulti = state.buffs.active ? 2 : 1;
    const sparkMulti = 1 + (state.sparks * 0.1) + (state.sparkUpgrades.astral_attunement ? 0.2 : 0) + (state.sparkUpgrades.cosmic_bloom ? 0.5 : 0);
    const tetherBonus = 1 + (state.sparkUpgrades.tether_mastery ? 0.25 : 0) + (state.sparkUpgrades.star_crucible ? 0.5 : 0);

    state.tethers.forEach(t => {
        const src = state.entityMap[t.sourceId];
        if (src && src.pods > 0.5) {
            const amount = Math.min(0.5, src.pods) * tetherBonus;
            src.pods -= amount;
            totalHarvested += amount;
            if (Math.random() > 0.5) {
                const tgt = state.entityMap[t.targetId];
                if (tgt) createSellParticle(src.x, src.y, tgt.x, tgt.y);
            }
        }
    });

    if (totalHarvested > 0) {
        const gained = totalHarvested * moteMultiplier * buffMulti * sparkMulti;
        state.motes += gained;
        state.stats.totalMotesEarned += gained;
        updateHUD();
        updateHUD('motes');
    }
}
setInterval(tetherHarvest, 2000);

let lastHUDState = {
    pods: -1,
    motes: -1,
    stars: -1,
    sparks: -1,
    buffActive: null,
    buffTimer: -1,
    level: -1,
    objectiveProgress: -1
};

function updateHUD(type = null) {
    const currentPods = Math.floor(state.pods);
    const currentMotes = Math.floor(state.motes);
    const objective = getLevelObjective(state.level);
    const progress = getObjectiveProgress(objective);

    // Only update text if content changed
    if (currentPods !== lastHUDState.pods || state.player.maxPods !== lastHUDState.maxPods) {
        podsDisplay.textContent = `${currentPods} / ${state.player.maxPods}`;
        podsDisplay.parentElement.classList.toggle('bag-full', currentPods >= state.player.maxPods);
        podsDisplay.style.color = currentPods >= state.player.maxPods ? '#ff4444' : 'var(--neon-cyan)';
        podsDisplay.style.textShadow = currentPods >= state.player.maxPods ? '0 0 10px #ff4444' : '0 0 10px var(--neon-cyan)';
        lastHUDState.pods = currentPods;
        lastHUDState.maxPods = state.player.maxPods;
    }

    if (currentMotes !== lastHUDState.motes) {
        motesDisplay.textContent = currentMotes;
        lastHUDState.motes = currentMotes;
    }

    // Handle pulses - only if explicitly requested
    if (type === 'pods') {
        podsDisplay.classList.remove('pulses');
        void podsDisplay.offsetWidth; // Force reflow for re-animation
        podsDisplay.classList.add('pulses');
    }
    if (type === 'motes') {
        motesDisplay.classList.remove('pulses');
        void motesDisplay.offsetWidth;
        motesDisplay.classList.add('pulses');
    }
    if (type === 'stars') {
        starsCount.classList.remove('pulses');
        void starsCount.offsetWidth;
        starsCount.classList.add('pulses');
    }

    if (state.stats.totalStarsHarvested > 0) {
        if (starsItem && starsItem.style.display !== 'flex') starsItem.style.display = 'flex';
        if (starsCount.textContent != state.starFragments) {
            starsCount.textContent = state.starFragments;
        }
    }

    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    if (weaverLevel > 0) {
        if (buildToggle.style.display !== 'flex') buildToggle.style.display = 'flex';

        // Ensure structure is intact if it was wiped
        if (!buildToggle.querySelector('.btn-label')) {
            buildToggle.innerHTML = `<span class="btn-icon">🔗</span> <span class="btn-label">Tether</span> <span id="tether-count"></span>`;
        }

        const countEl = document.getElementById('tether-count');
        const labelEl = buildToggle.querySelector('.btn-label');

        if (countEl) {
            const tetherCountText = `${state.tethers.length}/${weaverLevel}`;
            if (countEl.textContent !== tetherCountText) countEl.textContent = tetherCountText;
        }

        if (labelEl) {
            const desiredLabel = state.buildMode.active ? 'EXIT BUILD' : 'TETHER';
            if (labelEl.textContent !== desiredLabel) labelEl.textContent = desiredLabel;
        }

        buildToggle.classList.toggle('active-mode', state.buildMode.active);
        buildToggle.style.background = state.buildMode.active ? 'rgba(0, 255, 128, 0.6)' : 'rgba(0, 255, 128, 0.2)';
    } else {
        if (buildToggle.style.display !== 'none') buildToggle.style.display = 'none';
    }

    if (state.sparks > 0) {
        if (sparksItem && sparksItem.style.display !== 'flex') sparksItem.style.display = 'flex';
        if (sparksCount.textContent != state.sparks) {
            sparksCount.textContent = state.sparks;
        }
    }

    // Buff Display is now handled by updateBoosts() to allow multi-bubble support

    if (levelDisplay && state.level !== lastHUDState.level) {
        levelDisplay.textContent = state.level;
        lastHUDState.level = state.level;
    }

    if (objectiveDesc && (progress !== lastHUDState.objectiveProgress || state.level !== lastHUDState.level)) {
        objectiveDesc.innerHTML = `${objective.desc}: <span id="objective-progress" class="${progress >= objective.target ? 'neon-purple' : 'neon-lime'}">${Math.min(progress, objective.target)}</span> / <span id="objective-target">${objective.target}</span>`;
        lastHUDState.objectiveProgress = progress;
    }

    updateBurstUI();

    if (levelUpBtn) {
        const canLevel = progress >= objective.target;
        if (levelUpBtn.style.display !== (canLevel ? 'block' : 'none')) {
            levelUpBtn.style.display = canLevel ? 'block' : 'none';
        }
    }
}

function renderUpgrades() {
    upgradeList.innerHTML = '';

    // Update tab button visual state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === activeUpgradeTab);
    });

    state.upgrades.forEach(upgrade => {
        // Filter by active tab (fallback to 'motes' if currency is missing)
        const currency = upgrade.currency || 'motes';
        if (currency !== activeUpgradeTab) return;

        const cost = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMult, upgrade.level));
        const currencySym = upgrade.currency === 'starFragments' ? '🌟' : '✨';
        const canAfford = upgrade.currency === 'starFragments' ? state.starFragments >= cost : state.motes >= cost;
        const colorClass = upgrade.currency === 'starFragments' ? 'neon-gold' : 'neon-lime';

        if (upgrade.currency === 'starFragments' && state.stats.totalStarsHarvested === 0) return; // Hide until player finds a star

        const card = document.createElement('div');
        card.className = 'upgrade-card glass';

        // Companion Limit Logic
        let displayCost = cost;
        let btnText = `${displayCost} ${currencySym}`;
        let isLimitReached = false;
        if (upgrade.id === 'sentinel') {
            const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
            if (upgrade.level >= weaverLevel) {
                isLimitReached = true;
                btnText = "Tether Limit Reached";
            }
        }
        // v3.1 maxLevel cap (active abilities are 0/1 unlocks)
        if (upgrade.maxLevel && upgrade.level >= upgrade.maxLevel) {
            isLimitReached = true;
            btnText = 'Unlocked';
        }

        // v3.0: next-level effect preview (tooltip-style line under description)
        let nextLine = '';
        if (isLimitReached) {
            nextLine = `<div class="upgrade-next max">★ Max for current tether tier</div>`;
        } else {
            const cur = upgrade.level > 0 ? formatUpgradeEffect(upgrade, upgrade.level) : null;
            const next = formatUpgradeEffect(upgrade, upgrade.level + 1);
            nextLine = `<div class="upgrade-next">${cur ? `${cur} <span class="arrow">→</span> ${next}` : `Lv 1: ${next}`}</div>`;
        }
        card.innerHTML = `<div><h3>${upgrade.name} (Lv. ${upgrade.level})</h3><p>${upgrade.description}</p>${nextLine}</div><button class="upgrade-btn" style="${upgrade.currency === 'starFragments' ? 'background: #b8860b;' : ''}" ${canAfford && !isLimitReached ? '' : 'disabled'} data-id="${upgrade.id}">${btnText}</button>`;
        upgradeList.appendChild(card);
    });
}

function buyUpgrade(id) {
    const upgrade = state.upgrades.find(u => u.id === id);
    const cost = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMult, upgrade.level));

    console.log(`Attempting purchase: ${upgrade.name}. Current Level: ${upgrade.level}. Cost: ${cost}. Current Motes: ${state.motes}`);

    if (upgrade.currency === 'starFragments') {
        if (state.starFragments >= cost) {
            state.starFragments -= cost;
            upgrade.level++;
            state.stats.upgradesBoughtThisLevel++;
            applyUpgradeEffects(upgrade);
            updateHUD(); renderUpgrades(); saveGame();
            console.log(`Purchase Success: ${upgrade.name}. New Level: ${upgrade.level}`);
        }
    } else {
        if (state.motes >= cost) {
            state.motes -= cost;
            upgrade.level++;
            state.stats.upgradesBoughtThisLevel++;
            applyUpgradeEffects(upgrade);
            updateHUD(); renderUpgrades(); saveGame();
            console.log(`Purchase Success: ${upgrade.name}. New Level: ${upgrade.level}`);
        }
    }
}

function applyUpgradeEffects(upgrade) {
    // v3.1 Cosmos tier stacks on top of base astral bonuses
    const speedBonus = 1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0) + (state.sparkUpgrades.eternal_stride ? 0.30 : 0);
    const capBonus   = (state.sparkUpgrades.celestial_pockets ? 50 : 0) + (state.sparkUpgrades.phantom_pouch ? 100 : 0);

    if (upgrade.id === 'speed') state.player.speed = upgrade.effect(upgrade.level) * speedBonus;
    else if (upgrade.id === 'capacity') state.player.maxPods = upgrade.effect(upgrade.level) + capBonus;
    else if (upgrade.id === 'sentinel') {
        const newCompanion = { id: Date.now(), x: state.player.x, y: state.player.y, variant: 'sentinel' };
        state.companions.push(newCompanion);
        spawnCompanionElement(newCompanion);
    }
}

function renderCosmetics() {
    cosmeticList.innerHTML = '';
    state.cosmetics.forEach(cosmetic => {
        const isEquipped = state.player.sprite === cosmetic.icon;
        const currencySym = cosmetic.currency === 'starFragments' ? '🌟' : '✨';
        const canAfford = cosmetic.currency === 'starFragments' ? state.starFragments >= cosmetic.price : state.motes >= cosmetic.price;
        const starColor = cosmetic.currency === 'starFragments' ? 'background: #b8860b;' : '';

        const card = document.createElement('div');
        card.className = `cosmetic-card glass ${isEquipped ? 'equipped' : ''}`;

        // v3.0: layered sprite preview inside the cosmetic card
        const preview = `<div class="cosmetic-preview">${SPRITE_TEMPLATES[cosmetic.key] || cosmetic.icon}</div>`;
        if (cosmetic.unlocked) {
            card.innerHTML = `
                ${preview}
                <h3>${cosmetic.name}</h3>
                <button class="upgrade-btn cosmetic-btn" data-id="${cosmetic.id}" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Equipped' : 'Equip'}</button>
            `;
        } else if (cosmetic.bossLocked) {
            // Boss-locked cosmetic — show the boss name as the requirement
            const bossDef = BOSS_DEFS[cosmetic.bossLocked];
            const bossName = bossDef ? bossDef.name : 'a boss';
            card.innerHTML = `
                <div class="cosmetic-preview locked">${SPRITE_TEMPLATES[cosmetic.key] || cosmetic.icon}</div>
                <h3>${cosmetic.name}</h3>
                <button class="upgrade-btn cosmetic-btn" disabled style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,0,123,0.4); color: var(--neon-pink);">Defeat ${bossName}</button>
            `;
        } else {
            card.innerHTML = `
                <div class="cosmetic-preview locked">${SPRITE_TEMPLATES[cosmetic.key] || cosmetic.icon}</div>
                <h3>${cosmetic.name}</h3>
                <button class="upgrade-btn cosmetic-btn" style="${starColor}" ${canAfford ? '' : 'disabled'} data-id="${cosmetic.id}">${cosmetic.price} ${currencySym}</button>
            `;
        }
        cosmeticList.appendChild(card);
    });
}

function handleCosmeticClick(id) {
    const cosmetic = state.cosmetics.find(c => c.id === id);
    if (!cosmetic) return;

    if (cosmetic.unlocked) {
        state.player.sprite = cosmetic.icon;
        renderCosmetics();
        saveGame();
    } else {
        const canAfford = cosmetic.currency === 'starFragments' ? state.starFragments >= cosmetic.price : state.motes >= cosmetic.price;
        if (canAfford) {
            if (cosmetic.currency === 'starFragments') state.starFragments -= cosmetic.price;
            else state.motes -= cosmetic.price;

            cosmetic.unlocked = true;
            state.player.sprite = cosmetic.icon;
            updateHUD();
            renderCosmetics();
            saveGame();
            playLevelUpSound(); // small celebration
        }
    }
}

function calculateSparksReward() {
    // v3.0: gentler curve — sqrt-based so deeper runs are exponentially more rewarding
    const m = Math.max(0, state.stats.totalMotesEarned);
    return Math.floor(Math.sqrt(m / 1200));
}

function handleAscend() {
    // Submit run score to global leaderboard BEFORE state mutations
    const finalMotes = state.stats.totalMotesEarned;
    const finalLevel = state.level;
    if (!state.dailyMode) cloudSubmitScore('run', '', finalMotes, finalLevel);

    if (state.dailyMode) endDailyChallenge();
    const reward = calculateSparksReward();
    state.sparks += reward;
    // Lifetime: count ascension + track fastest if we started timing this run
    state.lifetime.ascensions = (state.lifetime.ascensions || 0) + 1;
    if (state._runStartSec != null) {
        const elapsed = (state.lifetime.playSec || 0) - state._runStartSec;
        if (elapsed > 0 && (state.runRecords.fastestAscendSec == null || elapsed < state.runRecords.fastestAscendSec)) {
            state.runRecords.fastestAscendSec = elapsed;
        }
    }
    state._runStartSec = state.lifetime.playSec || 0;
    playTone(600, 'sine', 1.0, 0.8);
    ascendPanel.classList.remove('active');
    openAstralForge();
    saveGame();
}

function openAstralForge() {
    astralSparkCount.textContent = state.sparks;
    renderAstralTree();
    astralPanel.classList.add('active');
}

function renderAstralTree() {
    astralTree.innerHTML = '';
    // Cosmos nodes also require ≥1 ascension OR any prior cosmos node already purchased
    const cosmosUnlocked = (state.lifetime?.ascensions || 0) >= 1;

    astralUpgrades.forEach(upg => {
        const level = state.sparkUpgrades[upg.id] || 0;
        const isPurchased = level > 0;
        let isAvailable = !isPurchased && (!upg.req || state.sparkUpgrades[upg.req] > 0);
        if (upg.tier === 'cosmos' && !cosmosUnlocked) isAvailable = false;
        const isLocked = !isPurchased && !isAvailable;

        const node = document.createElement('div');
        node.className = `astral-node ${isPurchased ? 'purchased' : (isAvailable ? 'available' : 'locked')}${upg.tier === 'cosmos' ? ' cosmos' : ''}`;
        node.style.position = 'absolute';
        node.style.left = `${upg.x}%`;
        node.style.top = `${upg.y}%`;
        node.style.transform = 'translate(-50%, -50%)';

        node.innerHTML = `
            <i>${upg.icon}</i>
            <span class="node-title">${upg.name}</span>
            <div class="node-desc">${upg.description}</div>
            <div class="node-cost">${isPurchased ? '✓' : upg.cost + ' ✨'}</div>
        `;

        node.onclick = () => {
            if (isAvailable && state.sparks >= upg.cost) {
                state.sparks -= upg.cost;
                state.sparkUpgrades[upg.id] = 1;
                playLevelUpSound();
                renderAstralTree();
                astralSparkCount.textContent = state.sparks;
                saveGame();
            }
        };

        astralTree.appendChild(node);
    });
}

function beginJourney() {
    // Lifetime: count this as a new run
    state.lifetime.runs = (state.lifetime.runs || 0) + 1;
    // Reset boss defeats for this run; clear any active boss DOM
    state.bosses.defeatedThisRun = {};
    if (state.activeBoss && state.activeBoss.el) state.activeBoss.el.remove();
    if (state.activeBoss && state.activeBoss.telegraphEl) state.activeBoss.telegraphEl.remove();
    state.activeBoss = null;
    hideBossHpBar();
    // Reset Game
    state.level = 1;
    state.motes = 0;
    state.pods = 0;
    state.world = { width: 2000, height: 2000 };
    state.stats.totalMotesEarned = 0;
    state.stats.upgradesBoughtThisLevel = 0;
    state.stats.totalPodsHarvested = 0;

    // Un-equip non-cosmetic upgrades
    state.upgrades.forEach(u => u.level = 0);

    // Apply permanent bonuses
    state.player.speed = state.upgrades.find(u => u.id === 'speed').effect(0) * (1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0));
    state.player.maxPods = state.upgrades.find(u => u.id === 'capacity').effect(0) + (state.sparkUpgrades.celestial_pockets ? 50 : 0);

    state.player.x = 1000;
    state.player.y = 1000;
    state.camera.x = 0;
    state.camera.y = 0;

    state.entities = [];
    state.tethers = [];
    state.buildMode.active = false;
    astralPanel.classList.remove('active');
    initWorld();
    updateWorldColors();
    updateHUD();
    renderUpgrades();
    saveGame();

    // Play big success sound
    setTimeout(() => playTone(300, 'sine', 1.0, 0.6), 0);
    setTimeout(() => playTone(500, 'sine', 1.5, 0.8), 400);
}

const SAVE_VERSION = 3.0;

function migrateSaveData(data) {
    if (!data) return {};

    // Always ensure keys exist, regardless of version
    if (!data.upgrades) data.upgrades = [];
    if (!data.sparkUpgrades) data.sparkUpgrades = {};
    if (!data.stats) data.stats = { totalPodsHarvested: 0, totalStarsHarvested: 0, totalMotesEarned: 0, upgradesBoughtThisLevel: 0 };
    if (!data.entities) data.entities = [];
    if (!data.tethers) data.tethers = [];
    if (!data.remnants) data.remnants = [];
    if (!data.companions) data.companions = [];
    if (!data.settings) data.settings = { masterVolume: 80, bgmVolume: 80, sfxVolume: 80, showParticles: true, screenshake: true };

    // Handle volume migration from old 'volume' field
    if (data.settings.volume !== undefined && data.settings.masterVolume === undefined) {
        data.settings.masterVolume = data.settings.volume;
        data.settings.bgmVolume = data.settings.volume;
        data.settings.sfxVolume = data.settings.volume;
    }

    // Ensure defaults for new fields (and existing ones if they somehow got lost)
    if (data.settings.masterVolume === undefined) data.settings.masterVolume = 80;
    if (data.settings.bgmVolume === undefined) data.settings.bgmVolume = 80;
    if (data.settings.sfxVolume === undefined) data.settings.sfxVolume = 80;
    if (data.settings.showParticles === undefined) data.settings.showParticles = true; // Ensure this exists too
    if (data.settings.screenshake === undefined) data.settings.screenshake = true;

    if (!data.version || data.version < SAVE_VERSION) {
        console.log(`Migrating save from ${data.version || 'none'} to ${SAVE_VERSION}...`);
        data.version = SAVE_VERSION;
    }
    return data;
}

function saveGame() {
    if (isWiping) return;

    try {
        console.log("Saving game state...");
        const saveData = {
            version: SAVE_VERSION,
            instanceId: state.instanceId,
            lastModified: Date.now(),
            level: state.level,
            world: state.world,
            pods: Number(state.pods),
            motes: Number(state.motes),
            starFragments: Number(state.starFragments),
            sparks: Number(state.sparks),
            player: { x: state.player.x, y: state.player.y, sprite: state.player.sprite },
            stats: state.stats,
            settings: state.settings,
            buffs: state.buffs,
            upgrades: state.upgrades.map(u => ({ id: u.id, level: Number(u.level) || 0 })),
            sparkUpgrades: state.sparkUpgrades,
            achievements: state.achievements,
            dailyBest: state.dailyBest,
            streak: state.streak,
            bosses: state.bosses,
            codex: state.codex,
            bossRush: state.bossRush,
            profile: state.profile,
            lifetime: state.lifetime,
            runRecords: state.runRecords,
            dailyMode: !!state.dailyMode,
            runSnapshots: state.runSnapshots || { main: null, daily: null },
            cosmetics: state.cosmetics.map(c => ({ id: c.id, unlocked: !!c.unlocked })),
            tethers: state.tethers.map(t => ({ sourceId: t.sourceId, targetId: t.targetId, health: t.health, maxHealth: t.maxHealth })),
            remnants: state.remnants.map(r => ({ sourceId: r.sourceId, targetId: r.targetId, maxHealth: r.maxHealth })),
            entities: state.entities.map(e => {
                const { el, ...cleanE } = e;
                return cleanE;
            })
        };

        // Extra safety: manual check for circular or broken refs
        const json = JSON.stringify(saveData, (key, value) => {
            if (key === 'el') return undefined; // Should already be gone, but extra safety
            return value;
        });

        localStorage.setItem('lushHarvestSave', json);
        console.log(`Save Successful! Size: ${json.length} chars. Motes: ${saveData.motes}`);

        // Cloud mirror (debounced, fire-and-forget — local save is the source of truth)
        queueCloudSave(saveData);
    } catch (e) {
        console.error("CRITICAL SAVE ERROR:", e);
    }
}

function loadGame() {
    console.group("Lush Harvest: Loading Save");
    try {
        const saved = localStorage.getItem('lushHarvestSave');
        if (!saved) {
            console.log("No save file discovered.");
            console.groupEnd();
            return;
        }

        let parsed = JSON.parse(saved);
        console.log("Raw Loaded Data:", parsed);

        parsed = migrateSaveData(parsed);

        // State Reconstruction
        if (typeof parsed.level === 'number') state.level = parsed.level;
        if (parsed.world) state.world = { ...state.world, ...parsed.world };

        state.pods = parsed.pods !== undefined ? Number(parsed.pods) : 0;
        state.motes = parsed.motes !== undefined ? Number(parsed.motes) : 0;
        state.starFragments = parsed.starFragments !== undefined ? Number(parsed.starFragments) : 0;
        state.sparks = parsed.sparks !== undefined ? Number(parsed.sparks) : 0;

        if (parsed.stats) state.stats = { ...state.stats, ...parsed.stats };
        if (parsed.settings) {
            state.settings = { ...state.settings, ...parsed.settings };
            // Apply UI settings
            const mVol = document.getElementById('master-volume-control');
            const bVol = document.getElementById('bgm-volume-control');
            const sVol = document.getElementById('sfx-volume-control');
            const part = document.getElementById('particles-toggle');
            const shake = document.getElementById('shake-toggle');

            if (mVol) mVol.value = state.settings.masterVolume;
            if (bVol) bVol.value = state.settings.bgmVolume;
            if (sVol) sVol.value = state.settings.sfxVolume;
            if (part) part.checked = state.settings.showParticles;
            if (shake) shake.checked = state.settings.screenshake;
            const rm = document.getElementById('reduced-motion-toggle');
            const cb = document.getElementById('colorblind-mode');
            if (rm) rm.checked = !!state.settings.reducedMotion;
            if (cb) cb.value = state.settings.colorblind || 'off';
            applyAccessibility();
            updateVolume();
        }

        if (parsed.player) {
            state.player.x = parsed.player.x !== undefined ? Number(parsed.player.x) : state.player.x;
            state.player.y = parsed.player.y !== undefined ? Number(parsed.player.y) : state.player.y;
            state.player.sprite = parsed.player.sprite || state.player.sprite;
        }

        if (Array.isArray(parsed.upgrades)) {
            parsed.upgrades.forEach(saveU => {
                const u = state.upgrades.find(upg => upg.id === saveU.id);
                if (u && saveU.level !== undefined) u.level = Number(saveU.level);
            });
        }

        if (parsed.sparkUpgrades) {
            state.sparkUpgrades = { ...state.sparkUpgrades, ...parsed.sparkUpgrades };
        }
        if (parsed.achievements) state.achievements = parsed.achievements;
        if (parsed.dailyBest)    state.dailyBest    = parsed.dailyBest;
        if (parsed.streak)       state.streak       = { ...state.streak, ...parsed.streak };
        if (parsed.bosses)       state.bosses       = { ...state.bosses, ...parsed.bosses };
        if (parsed.codex)        state.codex        = { spirits: {}, bosses: {}, secrets: {}, ...parsed.codex };
        if (parsed.bossRush)     state.bossRush     = { ...state.bossRush, ...parsed.bossRush };
        if (parsed.profile)      state.profile      = { ...state.profile, ...parsed.profile };
        if (parsed.lifetime)     state.lifetime     = { ...state.lifetime, ...parsed.lifetime };
        if (parsed.runRecords)   state.runRecords   = { ...state.runRecords, ...parsed.runRecords };
        if (parsed.runSnapshots) state.runSnapshots = { main: null, daily: null, ...parsed.runSnapshots };
        // Re-enable daily mode if save was made mid-daily
        if (parsed.dailyMode) {
            state.dailyMode = true;
            setSeed(getTodaySeed());
            patchRandomForDaily();
        }
        ensureProfileInitialized(); // guarantees player ID + joined date exist

        if (Array.isArray(parsed.cosmetics)) {
            parsed.cosmetics.forEach(saveC => {
                const c = state.cosmetics.find(cos => cos.id === saveC.id);
                if (c) c.unlocked = !!saveC.unlocked;
            });
        }

        if (Array.isArray(parsed.entities)) state.entities = parsed.entities;
        if (Array.isArray(parsed.tethers)) state.tethers = parsed.tethers;
        if (Array.isArray(parsed.remnants)) state.remnants = parsed.remnants;

        // Restore companions (these need DOM elements)
        if (Array.isArray(parsed.companions)) {
            state.companions = parsed.companions;
            state.companions.forEach(c => spawnCompanionElement(c));
        }

        // Apply permanent bonuses
        const speedBonus = 1 + (Number(state.sparkUpgrades.luminous_stride) ? 0.15 : 0);
        const capBonus = Number(state.sparkUpgrades.celestial_pockets) ? 50 : 0;
        const speedU = state.upgrades.find(u => u.id === 'speed');
        const capU = state.upgrades.find(u => u.id === 'capacity');

        state.player.speed = (speedU ? speedU.effect(speedU.level) : 4) * speedBonus;
        state.player.maxPods = (capU ? capU.effect(capU.level) : 20) + capBonus;

        console.log("Load Applied. Motes:", state.motes, "Upgrades:", state.upgrades.map(u => u.level));
    } catch (e) {
        console.error("CRITICAL LOAD ERROR:", e);
    }
    console.groupEnd();

    updateWorldColors();
    renderTethers();
    updateHUD();
    renderUpgrades();
}

setInterval(saveGame, 5000);

window.addEventListener('mousedown', handleJoystickStart);
window.addEventListener('mousemove', handleJoystickMove);
window.addEventListener('mouseup', handleJoystickEnd);
window.addEventListener('touchstart', (e) => { state.isTouch = true; document.body.classList.add('is-touch'); handleJoystickStart(e); }, { passive: false });
window.addEventListener('touchmove', handleJoystickMove, { passive: false });
window.addEventListener('touchend', handleJoystickEnd);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('beforeunload', saveGame);
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });
if (levelUpBtn) levelUpBtn.addEventListener('click', advanceLevel);

upgradesToggle.addEventListener('click', () => { renderUpgrades(); upgradesPanel.classList.add('active'); });
closeUpgrades.addEventListener('click', () => upgradesPanel.classList.remove('active'));
upgradeList.addEventListener('click', (e) => { if (e.target.classList.contains('upgrade-btn')) buyUpgrade(e.target.dataset.id); });

// astralToggle removed as requested
closeAstral.addEventListener('click', () => astralPanel.classList.remove('active'));
beginNextRun.addEventListener('click', beginJourney);

// v3.2.1 — Tether system overhaul: simple toggle + click-to-place / click-to-remove
function setBuildMode(on) {
    state.buildMode.active = !!on;
    state.buildMode.sourceId = null;
    document.body.classList.toggle('build-mode-active', state.buildMode.active);
    if (state.buildMode.active) refreshTetherableTreeHints();
    else clearTetherableTreeHints();
    updateHUD();
    updateBuildCounter();
}

function refreshTetherableTreeHints() {
    const connectedIds = new Set(state.tethers.map(t => t.sourceId));
    for (const e of state.entities) {
        if (e.type !== 'tree' || e.subType === 'star-tree') continue;
        const el = document.getElementById(e.id);
        if (!el) continue;
        const tethered = connectedIds.has(e.id);
        el.classList.add('tetherable');
        el.classList.toggle('tetherable-active', tethered);
        el.dataset.tetherTarget = e.id;
    }
}
function clearTetherableTreeHints() {
    document.querySelectorAll('.source-tree').forEach(el => {
        el.classList.remove('tetherable', 'tetherable-active');
        delete el.dataset.tetherTarget;
    });
}

function placeTetherOnTree(tree) {
    if (!tree || tree.type !== 'tree' || tree.subType === 'star-tree') return;
    const forge = state.entities.find(e => e.type === 'forge');
    if (!forge) return;
    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    if (state.tethers.length >= weaverLevel) {
        flashBuildCounter('Tether limit reached');
        return;
    }
    state.tethers.push({ sourceId: tree.id, targetId: forge.id, health: 100, maxHealth: 100 });
    state.runRecords.peakTethers = Math.max(state.runRecords.peakTethers || 0, state.tethers.length);
    renderTethers();
    refreshTetherableTreeHints();
    playTone(700, 'sine', 0.4, 0.3);
    playTone(900, 'sine', 0.3, 0.25);
    // small confirmation particle at the tree
    createHarvestParticle(tree.x, tree.y, true);
    updateHUD();
    updateBuildCounter();
    saveGame();
}

function removeTetherFromTree(tree) {
    const idx = state.tethers.findIndex(t => t.sourceId === tree.id);
    if (idx === -1) return;
    state.tethers.splice(idx, 1);
    renderTethers();
    refreshTetherableTreeHints();
    playTone(420, 'sawtooth', 0.3, 0.2);
    playTone(280, 'sine', 0.3, 0.25);
    updateHUD();
    updateBuildCounter();
    saveGame();
}

function updateBuildCounter() {
    const counter = document.getElementById('build-counter');
    if (!counter) return;
    if (!state.buildMode.active) { counter.style.display = 'none'; return; }
    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    counter.style.display = 'flex';
    counter.querySelector('.bc-current').textContent = state.tethers.length;
    counter.querySelector('.bc-max').textContent = weaverLevel;
    counter.classList.toggle('full', state.tethers.length >= weaverLevel);
}
function flashBuildCounter(msg) {
    const counter = document.getElementById('build-counter');
    if (!counter) return;
    const hint = counter.querySelector('.bc-hint');
    if (!hint) return;
    const prev = hint.textContent;
    hint.textContent = msg;
    hint.classList.add('flash');
    setTimeout(() => { hint.textContent = prev; hint.classList.remove('flash'); }, 1400);
}

buildToggle.addEventListener('click', () => {
    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    if (weaverLevel === 0) return;
    setBuildMode(!state.buildMode.active);
});

// Click delegation: when in build mode, clicking any tetherable tree toggles its tether
document.addEventListener('click', (e) => {
    if (!state.buildMode.active) return;
    const treeEl = e.target.closest('.source-tree.tetherable');
    if (!treeEl) return;
    e.stopPropagation();
    const treeId = treeEl.dataset.tetherTarget;
    const tree = state.entities.find(en => en.id === treeId);
    if (!tree) return;
    if (treeEl.classList.contains('tetherable-active')) {
        removeTetherFromTree(tree);
    } else {
        placeTetherOnTree(tree);
    }
});

// ESC exits build mode
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.buildMode.active) setBuildMode(false);
});

// Mobile: same click delegation also fires on touchstart on the tree
document.addEventListener('touchstart', (e) => {
    if (!state.buildMode.active) return;
    const treeEl = e.target.closest('.source-tree.tetherable');
    if (!treeEl) return;
    e.preventDefault();
    e.stopPropagation();
    const treeId = treeEl.dataset.tetherTarget;
    const tree = state.entities.find(en => en.id === treeId);
    if (!tree) return;
    if (treeEl.classList.contains('tetherable-active')) {
        removeTetherFromTree(tree);
    } else {
        placeTetherOnTree(tree);
    }
}, { passive: false });

cosmeticsToggle.addEventListener('click', () => { renderCosmetics(); cosmeticsPanel.classList.add('active'); });
closeCosmetics.addEventListener('click', () => cosmeticsPanel.classList.remove('active'));
cosmeticList.addEventListener('click', (e) => { if (e.target.classList.contains('cosmetic-btn')) handleCosmeticClick(e.target.dataset.id); });

settingsToggle.addEventListener('click', () => settingsPanel.classList.add('active'));

// v3.0: Hub — Home button reopens the main menu overlay
function openHub() {
    // Always open the menu FIRST so label refresh failures can't block it
    const menu = document.getElementById('main-menu');
    if (menu) menu.classList.add('active');
    try {
        // Start Journey button is daily-aware: turns into Resume Main Run while in daily mode
        const startBtnText = document.querySelector('#start-game .btn-text');
        if (startBtnText) {
            startBtnText.textContent = state.dailyMode ? 'Return to Main Run' : 'Continue Journey';
        }
        // Daily button: resume / new / show today's best
        const menuDailyBtn = document.getElementById('menu-daily-btn');
        if (menuDailyBtn) {
            const seed = getTodaySeed();
            const best = state.dailyBest && state.dailyBest[seed];
            const hasInProgress = state.runSnapshots
                && state.runSnapshots.daily
                && state.runSnapshots.daily.seed === seed;
            let label;
            if (state.dailyMode)       label = 'Resume Daily Run';
            else if (hasInProgress)    label = `Resume Daily · ${formatNumber(state.runSnapshots.daily.motes)} motes`;
            else if (best)             label = `Daily Challenge · Best ${formatNumber(best.motes)}`;
            else                       label = 'Daily Challenge';
            menuDailyBtn.innerHTML = `<span class="btn-icon">🏅</span> ${label}`;
        }
    } catch (e) { console.warn('[Hub] label refresh failed:', e); }
}
const homeToggle = document.getElementById('home-toggle');
if (homeToggle) {
    homeToggle.addEventListener('click', (e) => { e.stopPropagation(); openHub(); });
}

// v3.0: Profile panel
const profilePanel = document.getElementById('profile-panel');
const closeProfile = document.getElementById('close-profile');
function openProfile() {
    ensureProfileInitialized();
    renderProfile();
    profilePanel.classList.add('active');
}
if (closeProfile) closeProfile.addEventListener('click', () => profilePanel.classList.remove('active'));

const menuProfileBtn = document.getElementById('menu-profile-btn');
if (menuProfileBtn) menuProfileBtn.addEventListener('click', () => { mainMenu.classList.remove('active'); openProfile(); });

const profileNameInput = document.getElementById('profile-name-input');
if (profileNameInput) {
    let nameDebounce;
    profileNameInput.addEventListener('input', (e) => {
        const v = e.target.value.trim().slice(0, 24) || 'Wanderer';
        state.profile.name = v;
        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(saveGame, 400);
    });
}
// v3.2 Title chip click → equip
document.addEventListener('click', (e) => {
    const chip = e.target.closest('.title-chip[data-title-id]');
    if (!chip) return;
    const id = chip.dataset.titleId;
    if (!isTitleUnlocked(id)) return;
    state.profile.title = id;
    renderProfile();
    saveGame();
});
const profileIdCopy = document.getElementById('profile-id-copy');
if (profileIdCopy) {
    profileIdCopy.addEventListener('click', () => {
        const msg = document.getElementById('profile-msg');
        navigator.clipboard.writeText(state.profile.playerId || '').then(() => {
            if (msg) { msg.textContent = 'Player ID copied!'; msg.style.color = 'var(--neon-lime)'; }
        }).catch(() => {
            if (msg) { msg.textContent = 'Copy failed.'; msg.style.color = '#ff6464'; }
        });
        setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
    });
}
const profileExport = document.getElementById('profile-export');
const profileImport = document.getElementById('profile-import');
if (profileExport) profileExport.addEventListener('click', () => exportSaveBtn.click());
if (profileImport) profileImport.addEventListener('click', () => importSaveBtn.click());

// v3.0: Leaderboard panel
const leaderboardPanel = document.getElementById('leaderboard-panel');
const closeLeaderboard = document.getElementById('close-leaderboard');
function openLeaderboard() {
    renderLeaderboard();
    leaderboardPanel.classList.add('active');
}
if (closeLeaderboard) closeLeaderboard.addEventListener('click', () => leaderboardPanel.classList.remove('active'));
const menuLeaderboardBtn = document.getElementById('menu-leaderboard-btn');
if (menuLeaderboardBtn) menuLeaderboardBtn.addEventListener('click', () => { mainMenu.classList.remove('active'); openLeaderboard(); });

document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        activeLeaderboardTab = tab.dataset.tab;
        renderLeaderboard();
    });
});

// v3.0: Achievements panel
const achievementsToggle = document.getElementById('achievements-toggle');
const achievementsPanel = document.getElementById('achievements-panel');
const closeAchievements = document.getElementById('close-achievements');
const achievementList = document.getElementById('achievement-list');
if (achievementsToggle) {
    achievementsToggle.addEventListener('click', () => {
        renderAchievements();
        achievementsPanel.classList.add('active');
    });
}
if (closeAchievements) {
    closeAchievements.addEventListener('click', () => achievementsPanel.classList.remove('active'));
}
if (achievementList) {
    achievementList.addEventListener('click', (e) => {
        const btn = e.target.closest('.ar-reward.claimable');
        if (btn) claimAchievement(btn.dataset.id);
    });
}
// Run a progress scan periodically so passive milestones (tethers, level, sparks) tick over
setInterval(notifyAchievementProgress, 2000);

// ============================================================
// v3.2 Patch-notes callout — show a small banner on first load after a version bump
// ============================================================
const CURRENT_VERSION = '3.2.1'; // bump when releasing a new changelog entry
function checkPatchNotesCallout() {
    const seen = localStorage.getItem('lushHarvest:seenVersion');
    if (seen === CURRENT_VERSION) return;
    const callout = document.getElementById('patch-callout');
    if (!callout) return;
    callout.querySelector('.pc-version').textContent = `v${CURRENT_VERSION}`;
    callout.classList.add('show');
}
function dismissPatchCallout(opts = {}) {
    const callout = document.getElementById('patch-callout');
    if (callout) callout.classList.remove('show');
    localStorage.setItem('lushHarvest:seenVersion', CURRENT_VERSION);
    if (opts.openChangelog) openChangelog();
}

// v3.1 Changelog viewer — fetches changelog.md and renders a small subset of markdown
let _changelogLoaded = false;
async function openChangelog() {
    const panel = document.getElementById('changelog-panel');
    const body  = document.getElementById('changelog-body');
    if (!panel || !body) return;
    panel.classList.add('active');
    if (_changelogLoaded) return;
    try {
        const res = await fetch('./changelog.md?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const md = await res.text();
        body.innerHTML = renderChangelogMarkdown(md);
        _changelogLoaded = true;
    } catch (e) {
        body.innerHTML = `<div class="changelog-error">Could not load changelog: ${escapeHTML(e.message)}</div>`;
    }
}

function renderChangelogMarkdown(md) {
    // Escape any raw HTML first
    let safe = md.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    // Code spans
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italics (single _ or *)
    safe = safe.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    // Links [text](url)
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Process line-by-line for headings, lists, hr, paragraphs
    const lines = safe.split('\n');
    const out = [];
    let inList = false;
    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (/^---+\s*$/.test(ln)) { closeList(); out.push('<hr>'); continue; }
        let m;
        if ((m = ln.match(/^#\s+(.+)$/)))        { closeList(); out.push(`<h1>${m[1]}</h1>`); continue; }
        if ((m = ln.match(/^##\s+(.+)$/)))       { closeList(); out.push(`<h2>${m[1]}</h2>`); continue; }
        if ((m = ln.match(/^###\s+(.+)$/)))      { closeList(); out.push(`<h3>${m[1]}</h3>`); continue; }
        if ((m = ln.match(/^####\s+(.+)$/)))     { closeList(); out.push(`<h4>${m[1]}</h4>`); continue; }
        if ((m = ln.match(/^[\-\*]\s+(.+)$/)))   { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${m[1]}</li>`); continue; }
        if (ln.trim() === '')                    { closeList(); continue; }
        // Italic asterisk credit line
        closeList();
        out.push(`<p>${ln}</p>`);
    }
    closeList();
    return out.join('\n');
}

// v3.2 Photo Mode buttons
const photoToggle = document.getElementById('photo-toggle');
if (photoToggle) photoToggle.addEventListener('click', togglePhotoMode);
const photoExit = document.getElementById('photo-exit');
if (photoExit) photoExit.addEventListener('click', togglePhotoMode);

// v3.1 Ability buttons (touch/desktop click)
['dash', 'pulse', 'ward'].forEach(key => {
    const btn = document.getElementById('ab-' + key);
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); triggerAbility(key); });
});

// ============================================================
// v3.2 Photo Mode — clean stage for screenshots
// ============================================================
let _photoMode = false;
function togglePhotoMode() {
    _photoMode = !_photoMode;
    document.body.classList.toggle('photo-mode', _photoMode);
    const exitBtn = document.getElementById('photo-exit');
    if (exitBtn) exitBtn.style.display = _photoMode ? 'inline-flex' : 'none';
    const enterBtn = document.getElementById('photo-toggle');
    if (enterBtn) enterBtn.classList.toggle('active-mode', _photoMode);
    // Close any open overlays for a clean shot
    if (_photoMode) document.querySelectorAll('.overlay.active').forEach(o => o.classList.remove('active'));
}
window.addEventListener('keydown', (e) => {
    if (_photoMode && e.key === 'Escape') togglePhotoMode();
});

// v3.1 Changelog viewer triggers
const viewChangelogBtn = document.getElementById('view-changelog');
if (viewChangelogBtn) viewChangelogBtn.addEventListener('click', () => openChangelog());
const closeChangelogBtn = document.getElementById('close-changelog');
if (closeChangelogBtn) closeChangelogBtn.addEventListener('click', () => document.getElementById('changelog-panel').classList.remove('active'));

// v3.2 Codex panel
const codexPanel = document.getElementById('codex-panel');
const menuCodexBtn = document.getElementById('menu-codex-btn');
const closeCodexBtn = document.getElementById('close-codex');
if (menuCodexBtn) menuCodexBtn.addEventListener('click', () => {
    mainMenu.classList.remove('active');
    renderCodex();
    codexPanel.classList.add('active');
});
if (closeCodexBtn) closeCodexBtn.addEventListener('click', () => codexPanel.classList.remove('active'));

// v3.2 Boss Rush panel + banner + start
const bossRushPanel = document.getElementById('boss-rush-panel');
const menuBossRushBtn = document.getElementById('menu-bossrush-btn');
const closeBossRushBtn = document.getElementById('close-boss-rush');
const startBossRushBtn = document.getElementById('start-boss-rush');
const bossRushExitBtn = document.getElementById('boss-rush-exit');

function refreshBossRushMenuButton() {
    if (!menuBossRushBtn) return;
    menuBossRushBtn.style.display = bossRushUnlocked() ? 'flex' : 'none';
}
function renderBossRushStats() {
    const el = document.getElementById('boss-rush-stats');
    if (!el) return;
    const best = state.bossRush.bestTimeSec;
    const attempts = state.bossRush.attempts || 0;
    el.innerHTML = `
        <div style="display: flex; justify-content: space-around; gap: 20px;">
            <div><div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Best Time</div><div style="font-size: 1.2rem; font-weight: 800; color: ${best != null ? 'var(--neon-gold)' : 'var(--text-muted)'};">${best != null ? formatPlayTime(best) : '—'}</div></div>
            <div><div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Attempts</div><div style="font-size: 1.2rem; font-weight: 800;">${attempts}</div></div>
        </div>`;
}
if (menuBossRushBtn) menuBossRushBtn.addEventListener('click', () => {
    mainMenu.classList.remove('active');
    renderBossRushStats();
    bossRushPanel.classList.add('active');
});
if (closeBossRushBtn) closeBossRushBtn.addEventListener('click', () => bossRushPanel.classList.remove('active'));
if (startBossRushBtn) startBossRushBtn.addEventListener('click', () => {
    bossRushPanel.classList.remove('active');
    startBossRush();
});
if (bossRushExitBtn) bossRushExitBtn.addEventListener('click', () => {
    if (confirm('Forfeit this Boss Rush attempt? Your main run will be restored, but you won\'t get the rewards.')) exitBossRush();
});

// Refresh the Boss Rush menu visibility whenever the Hub opens (after openHub runs)
const _hbForBossRush = document.getElementById('home-toggle');
if (_hbForBossRush) _hbForBossRush.addEventListener('click', () => setTimeout(refreshBossRushMenuButton, 0));
// Also refresh once at boot in case the main menu is shown on initial load
setTimeout(refreshBossRushMenuButton, 200);

// v3.2 Patch callout buttons
const patchSeeBtn = document.getElementById('patch-see-whats-new');
const patchDismissBtn = document.getElementById('patch-dismiss');
if (patchSeeBtn) patchSeeBtn.addEventListener('click', () => dismissPatchCallout({ openChangelog: true }));
if (patchDismissBtn) patchDismissBtn.addEventListener('click', () => dismissPatchCallout());

// v3.1 Stats popover toggle
const statsToggle = document.getElementById('stats-toggle');
const runStatsPanel = document.getElementById('run-stats-panel');
if (statsToggle && runStatsPanel) {
    statsToggle.addEventListener('click', () => {
        const open = runStatsPanel.style.display !== 'none';
        runStatsPanel.style.display = open ? 'none' : 'flex';
        statsToggle.classList.toggle('active-mode', !open);
    });
}
document.addEventListener('DOMContentLoaded', () => {
    closeSettings.onclick = () => { settingsPanel.classList.remove('active'); settingsMsg.textContent = ''; };
    menuSettingsBtn.onclick = () => { settingsPanel.classList.add('active'); settingsMsg.textContent = ''; };

    const masterVol = document.getElementById('master-volume-control');
    if (masterVol) {
        masterVol.oninput = (e) => {
            state.settings.masterVolume = parseInt(e.target.value);
            updateVolume();
            saveGame();
        };
    }

    const bgmVol = document.getElementById('bgm-volume-control');
    if (bgmVol) {
        bgmVol.oninput = (e) => {
            state.settings.bgmVolume = parseInt(e.target.value);
            updateVolume();
            saveGame();
        };
    }

    const sfxVol = document.getElementById('sfx-volume-control');
    if (sfxVol) {
        sfxVol.oninput = (e) => {
            state.settings.sfxVolume = parseInt(e.target.value);
            updateVolume();
            saveGame();
        };
    }

    const particlesToggle = document.getElementById('particles-toggle');
    particlesToggle.onchange = (e) => {
        state.settings.showParticles = e.target.checked;
        saveGame();
    };

    const shakeToggle = document.getElementById('shake-toggle');
    if (shakeToggle) {
        shakeToggle.onchange = (e) => {
            state.settings.screenshake = e.target.checked;
            saveGame();
        };
    }

    // v3.0: Reduced motion + colorblind mode
    const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
    if (reducedMotionToggle) {
        reducedMotionToggle.checked = !!state.settings.reducedMotion;
        reducedMotionToggle.onchange = (e) => {
            state.settings.reducedMotion = e.target.checked;
            applyAccessibility();
            saveGame();
        };
    }
    const colorblindMode = document.getElementById('colorblind-mode');
    if (colorblindMode) {
        colorblindMode.value = state.settings.colorblind || 'off';
        colorblindMode.onchange = (e) => {
            state.settings.colorblind = e.target.value;
            applyAccessibility();
            saveGame();
        };
    }

    // v3.1 new settings
    const perfMode = document.getElementById('performance-mode-toggle');
    if (perfMode) {
        perfMode.checked = !!state.settings.performanceMode;
        perfMode.onchange = (e) => {
            state.settings.performanceMode = e.target.checked;
            applyAccessibility();
            saveGame();
        };
    }
    const evtToggle = document.getElementById('world-events-toggle');
    if (evtToggle) {
        evtToggle.checked = state.settings.worldEvents !== false;
        evtToggle.onchange = (e) => {
            state.settings.worldEvents = e.target.checked;
            saveGame();
        };
    }
    const zoom = document.getElementById('camera-zoom-control');
    const zoomVal = document.getElementById('camera-zoom-val');
    if (zoom && zoomVal) {
        zoom.value = Math.round((state.settings.cameraZoom || 1) * 100);
        zoomVal.textContent = zoom.value + '%';
        zoom.oninput = (e) => {
            state.settings.cameraZoom = parseInt(e.target.value) / 100;
            zoomVal.textContent = e.target.value + '%';
            applyAccessibility();
            saveGame();
        };
    }

    startGameBtn.onclick = () => {
        initAudio();
        mainMenu.classList.remove('active');
        if (state.dailyMode) {
            // Cleanly snapshot daily and restore main
            exitDailyToMain();
        }
    };

    // v3.0: Daily Challenge button
    const menuDailyBtn = document.getElementById('menu-daily-btn');
    if (menuDailyBtn) {
        const seed = getTodaySeed();
        const best = state.dailyBest && state.dailyBest[seed];
        if (best) {
            menuDailyBtn.innerHTML = `<span class="btn-icon">🏅</span> Daily Challenge · Best ${best.motes}`;
        }
        menuDailyBtn.onclick = () => {
            initAudio();
            mainMenu.classList.remove('active');
            startDailyChallenge();
        };
    }
});

exportSaveBtn.addEventListener('click', () => {
    saveGame();
    const saveData = localStorage.getItem('lushHarvestSave');
    if (saveData) {
        const encoded = btoa(unescape(encodeURIComponent(saveData)));
        navigator.clipboard.writeText(encoded).then(() => {
            settingsMsg.textContent = 'Save exported to clipboard!';
            settingsMsg.style.color = 'var(--neon-lime)';
        }).catch(err => {
            settingsMsg.textContent = 'Failed to copy to clipboard.';
            settingsMsg.style.color = 'red';
        });
    }
});

importSaveBtn.addEventListener('click', () => {
    const input = prompt("Paste your exported save string here to import. WARNING: This will overwrite your current save!");
    if (input) {
        try {
            const decoded = decodeURIComponent(escape(atob(input)));
            JSON.parse(decoded);
            isWiping = true;
            localStorage.setItem('lushHarvestSave', decoded);
            location.reload();
        } catch (e) {
            settingsMsg.textContent = 'Invalid save string!';
            settingsMsg.style.color = 'red';
        }
    }
});

wipeSaveBtn.addEventListener('click', () => {
    if (confirm("Are you SURE you want to completely erase your save data? This cannot be undone!")) {
        isWiping = true;
        localStorage.removeItem('lushHarvestSave');
        location.reload();
    }
});

document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            settingsMsg.textContent = '';
        }
    });
});

ascendToggle.addEventListener('click', () => {
    ascendReward.textContent = calculateSparksReward();
    ascendPanel.classList.add('active');
});
closeAscend.addEventListener('click', () => ascendPanel.classList.remove('active'));
confirmAscend.addEventListener('click', handleAscend);

setInterval(() => {
    // Timers are now handled in updateBoosts() to center logic
    updateHUD();
}, 1000);

// ============================================================
// v3.1 Bosses — mini-boss at A10, mega-boss at A20
// ============================================================
const BOSS_DEFS = {
    spirit_lord: {
        id: 'spirit_lord', name: 'The Spirit Lord', icon: '👁️',
        unlockArea: 10,
        hp: 30, size: 90, speed: 0.55,
        attackEveryMs: 5000, telegraphMs: 1500, attackRadius: 200, attackDamage: 18,
        rewards: { stars: 5, sparks: 0, cosmetic: 'voidcrown', motes: 1200 }
    },
    eclipse_sovereign: {
        id: 'eclipse_sovereign', name: 'Eclipse Sovereign', icon: '🌑',
        unlockArea: 20,
        hp: 80, size: 130, speed: 0.85,
        attackEveryMs: 3800, telegraphMs: 1100, attackRadius: 260, attackDamage: 30,
        rewards: { stars: 15, sparks: 2, cosmetic: 'sovereign_crown', motes: 5000 }
    }
};

// Tracks defeats — reset per-run for blocking, persistent for cosmetic unlocks
state.bosses = state.bosses || { defeatedThisRun: {}, defeatedEver: {} };

function bossDefIdForArea(level) {
    for (const def of Object.values(BOSS_DEFS)) {
        if (def.unlockArea === level) return def.id;
    }
    return null;
}

function spawnBossForArea() {
    const defId = bossDefIdForArea(state.level);
    if (!defId) return;
    if (state.bosses.defeatedThisRun[defId]) return;
    if (state.activeBoss) return;

    const def = BOSS_DEFS[defId];
    // Spawn in viewport center-ish offset away from player
    const angle = Math.random() * Math.PI * 2;
    const distance = 350;
    const bx = Math.max(150, Math.min(state.world.width - 150,  state.player.x + Math.cos(angle) * distance));
    const by = Math.max(150, Math.min(state.world.height - 150, state.player.y + Math.sin(angle) * distance));

    const boss = {
        defId,
        def,
        id: `boss-${defId}-${Date.now()}`,
        x: bx, y: by,
        hp: def.hp, maxHp: def.hp,
        lastAttackAt: Date.now(),
        telegraphingAt: null,
        invuln: false
    };
    state.activeBoss = boss;

    // DOM
    const el = document.createElement('div');
    el.className = `boss boss-${defId}`;
    el.id = boss.id;
    el.style.width  = `${def.size}px`;
    el.style.height = `${def.size}px`;
    el.innerHTML = `
        <div class="boss-aura"></div>
        <div class="boss-ring outer"></div>
        <div class="boss-ring mid"></div>
        <div class="boss-ring inner"></div>
        <div class="boss-core"></div>
        <div class="boss-name">${def.name}</div>`;
    entitiesLayer.appendChild(el);
    boss.el = el;

    // Telegraph indicator (hidden until charging an attack)
    const telegraph = document.createElement('div');
    telegraph.className = `boss-telegraph telegraph-${defId}`;
    telegraph.style.display = 'none';
    entitiesLayer.appendChild(telegraph);
    boss.telegraphEl = telegraph;

    // HP bar UI at top
    showBossHpBar(def);

    // Announcement
    showAchievementToast({ icon: def.icon, name: def.name + ' Awakens', reward: { motes: 0 } });
    const t = document.getElementById('achievement-toast');
    if (t) {
        t.querySelector('.ach-label').textContent = 'BOSS';
        t.querySelector('.ach-reward').textContent = 'Defeat it to continue. Use burst (Space) or sentinels.';
        t.style.borderColor = '#ff007b';
        setTimeout(() => {
            t.querySelector('.ach-label').textContent = 'Achievement Unlocked';
            t.style.borderColor = '';
        }, 5000);
    }
    triggerShake();
    playTone(60, 'sawtooth', 0.6, 1.2, true);
}

function showBossHpBar(def) {
    let bar = document.getElementById('boss-hp-bar');
    if (!bar) return;
    bar.style.display = 'flex';
    bar.querySelector('.bhp-name').textContent = def.name;
    bar.querySelector('.bhp-icon').textContent = def.icon;
}
function hideBossHpBar() {
    const bar = document.getElementById('boss-hp-bar');
    if (bar) bar.style.display = 'none';
}
function updateBossHpBar() {
    if (!state.activeBoss) return;
    const bar = document.getElementById('boss-hp-bar');
    if (!bar) return;
    const fill = bar.querySelector('.bhp-fill');
    const pct = Math.max(0, state.activeBoss.hp / state.activeBoss.maxHp);
    fill.style.width = `${pct * 100}%`;
}

function damageBoss(amount) {
    const b = state.activeBoss;
    if (!b || b.invuln) return;
    b.hp -= amount;
    updateBossHpBar();
    if (b.el) {
        b.el.classList.remove('boss-hurt');
        void b.el.offsetWidth;
        b.el.classList.add('boss-hurt');
    }
    if (b.hp <= 0) defeatBoss();
}

function defeatBoss() {
    const b = state.activeBoss;
    if (!b) return;
    state.activeBoss = null;

    const def = b.def;
    // Reward
    state.starFragments += def.rewards.stars || 0;
    state.sparks += def.rewards.sparks || 0;
    state.motes += def.rewards.motes || 0;
    state.stats.totalMotesEarned += def.rewards.motes || 0;
    state.bosses.defeatedThisRun[def.id] = true;
    state.bosses.defeatedEver[def.id] = true;
    recordCodexEncounter('bosses', def.id);

    // Unlock the boss-locked cosmetic
    if (def.rewards.cosmetic) {
        const cos = state.cosmetics.find(c => c.key === def.rewards.cosmetic);
        if (cos && !cos.unlocked) cos.unlocked = true;
    }

    // Visual death burst
    if (b.el) {
        b.el.classList.add('boss-dying');
        for (let i = 0; i < 24; i++) {
            const p = document.createElement('div');
            p.className = 'boss-death-spark';
            p.style.left = `${b.x}px`;
            p.style.top  = `${b.y}px`;
            const angle = (i / 24) * Math.PI * 2;
            p.style.setProperty('--dx', Math.cos(angle) * 120 + 'px');
            p.style.setProperty('--dy', Math.sin(angle) * 120 + 'px');
            entitiesLayer.appendChild(p);
            setTimeout(() => p.remove(), 1200);
        }
        setTimeout(() => { if (b.el && b.el.parentNode) b.el.remove(); }, 800);
    }
    if (b.telegraphEl) b.telegraphEl.remove();
    hideBossHpBar();
    triggerShake();
    playTone(200, 'sawtooth', 0.5, 0.5);
    playTone(400, 'sine', 0.6, 0.8);
    playTone(800, 'sine', 0.8, 1.0);

    // Toast
    showAchievementToast({ icon: '👑', name: def.name + ' Defeated', reward: { motes: 0 } });
    const t = document.getElementById('achievement-toast');
    if (t) t.querySelector('.ach-reward').textContent =
        `+${def.rewards.stars} ⭐ +${def.rewards.motes} motes` + (def.rewards.sparks ? ` +${def.rewards.sparks} ✨` : '') + (def.rewards.cosmetic ? ` +Cosmetic` : '');

    updateHUD();
    saveGame();
    // Push score boost to cloud (counts as a recordable milestone)
    cloudSubmitScore('run', '', state.stats.totalMotesEarned, state.level);
    // If we're in Boss Rush, advance to the next boss in the queue
    if (isInBossRush()) onBossRushKillNext();
}

function updateBoss() {
    const b = state.activeBoss;
    if (!b || !b.el) return;
    const def = b.def;

    // Position element
    b.el.style.left = `${b.x - def.size / 2}px`;
    b.el.style.top  = `${b.y - def.size / 2}px`;

    // Move toward player slowly
    const dx = state.player.x - b.x, dy = state.player.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const minRange = 120; // stop a bit out from the player
    if (dist > minRange) {
        b.x += (dx / dist) * def.speed;
        b.y += (dy / dist) * def.speed;
    }

    // Attack cycle
    const now = Date.now();
    if (b.telegraphingAt && now - b.telegraphingAt >= def.telegraphMs) {
        // Slam executes
        const px = state.player.x, py = state.player.y;
        const ddx = px - b.telegraphX, ddy = py - b.telegraphY;
        if (ddx * ddx + ddy * ddy < def.attackRadius * def.attackRadius) {
            state.pods = Math.max(0, state.pods - def.attackDamage);
            triggerShake();
            playTone(80, 'sawtooth', 0.5, 0.4);
            updateHUD();
        }
        if (b.telegraphEl) b.telegraphEl.style.display = 'none';
        b.telegraphingAt = null;
        b.lastAttackAt = now;
    } else if (!b.telegraphingAt && now - b.lastAttackAt >= def.attackEveryMs) {
        // Start charging an attack centered on the player's current position
        b.telegraphingAt = now;
        b.telegraphX = state.player.x;
        b.telegraphY = state.player.y;
        if (b.telegraphEl) {
            b.telegraphEl.style.display = 'block';
            b.telegraphEl.style.width  = `${def.attackRadius * 2}px`;
            b.telegraphEl.style.height = `${def.attackRadius * 2}px`;
            b.telegraphEl.style.left   = `${b.telegraphX - def.attackRadius}px`;
            b.telegraphEl.style.top    = `${b.telegraphY - def.attackRadius}px`;
            b.telegraphEl.style.animation = `boss-telegraph-charge ${def.telegraphMs}ms linear forwards`;
        }
        playTone(120, 'triangle', 0.3, 0.3);
    }

    // Burst damage detection (handled in triggerBurst's animation loop — we add a check here too)
    if (state.burst.active) {
        const bdx = b.x - state.burst.x, bdy = b.y - state.burst.y;
        if (bdx * bdx + bdy * bdy < (state.burst.radius + def.size / 2) ** 2) {
            if (!b._burstTaggedAt || now - b._burstTaggedAt > 200) {
                b._burstTaggedAt = now;
                damageBoss(1);
            }
        }
    }
}

// ============================================================
// v3.1 Active abilities — Luminous Dash, Chrono-Pulse, Spirit Ward
// ============================================================
function abilityUnlocked(key) {
    return state.upgrades.find(u => u.id === 'ability_' + key)?.level > 0;
}
function abilityReady(key) {
    const ab = state.abilities[key];
    return ab && (Date.now() - ab.triggeredAt) >= ab.cdMs;
}
function abilityCooldownPct(key) {
    const ab = state.abilities[key];
    if (!ab) return 1;
    const elapsed = Date.now() - ab.triggeredAt;
    return Math.max(0, Math.min(1, 1 - elapsed / ab.cdMs));
}
function triggerAbility(key) {
    if (!abilityUnlocked(key) || !abilityReady(key)) return;
    state.abilities[key].triggeredAt = Date.now();
    if (key === 'dash')  doDash();
    if (key === 'pulse') doPulse();
    if (key === 'ward')  doWard();
}

function doDash() {
    // Direction = current movement input
    const vk = getKeyboardVector();
    const v = state.joystick.active ? state.joystick.vector : vk;
    if (v.x === 0 && v.y === 0) { state.abilities.dash.triggeredAt = 0; return; } // refund
    const mag = Math.hypot(v.x, v.y) || 1;
    const dx = v.x / mag, dy = v.y / mag;
    const distance = 160;
    const nx = Math.max(0, Math.min(state.world.width,  state.player.x + dx * distance));
    const ny = Math.max(0, Math.min(state.world.height, state.player.y + dy * distance));
    // Ghost trail
    for (let i = 1; i <= 5; i++) {
        const t = state.player.x + (nx - state.player.x) * (i / 6);
        const u = state.player.y + (ny - state.player.y) * (i / 6);
        setTimeout(() => {
            const g = document.createElement('div');
            g.className = 'dash-ghost';
            g.style.left = `${t - 20}px`;
            g.style.top  = `${u - 20}px`;
            entitiesLayer.appendChild(g);
            setTimeout(() => g.remove(), 480);
        }, i * 25);
    }
    state.player.x = nx;
    state.player.y = ny;
    // Stun nearby spirits along the dash
    state.voidSpirits.forEach(s => {
        const ddx = s.x - nx, ddy = s.y - ny;
        if (ddx * ddx + ddy * ddy < 10000) s.dispelling = true; // 100 radius
    });
    playTone(720, 'sine', 0.4, 0.18);
    playTone(960, 'sine', 0.35, 0.12);
    triggerShake();
}

function doPulse() {
    // Freeze spirits + boost tree regrowth in 280-radius for 6s
    const R2 = 280 * 280;
    const until = Date.now() + 6000;
    state.voidSpirits.forEach(s => {
        const dx = s.x - state.player.x, dy = s.y - state.player.y;
        if (dx * dx + dy * dy < R2) s.frozenUntil = until;
    });
    state.entities.forEach(e => {
        if (e.type === 'tree') {
            const dx = e.x - state.player.x, dy = e.y - state.player.y;
            if (dx * dx + dy * dy < R2) e.boostedUntil = until;
        }
    });
    // Visual: expanding pulse ring
    const ring = document.createElement('div');
    ring.className = 'chrono-pulse';
    ring.style.left = `${state.player.x}px`;
    ring.style.top  = `${state.player.y}px`;
    entitiesLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
    playTone(420, 'sine', 0.5, 0.5);
    playTone(840, 'sine', 0.4, 0.5);
}

function doWard() {
    const until = Date.now() + 12000;
    state.tethers.forEach(t => { t.wardedUntil = until; });
    renderTethers();
    // Visual: golden ripple at forge
    const forge = state.entities.find(e => e.type === 'forge');
    if (forge) {
        const r = document.createElement('div');
        r.className = 'ward-ripple';
        r.style.left = `${forge.x}px`;
        r.style.top  = `${forge.y}px`;
        entitiesLayer.appendChild(r);
        setTimeout(() => r.remove(), 1100);
    }
    playTone(600, 'sine', 0.5, 0.4);
    playTone(900, 'sine', 0.4, 0.4);
}

function updateAbilityButtons() {
    ['dash', 'pulse', 'ward'].forEach(key => {
        const btn = document.getElementById('ab-' + key);
        if (!btn) return;
        const unlocked = abilityUnlocked(key);
        btn.style.display = unlocked ? 'flex' : 'none';
        if (!unlocked) return;
        const fill = btn.querySelector('.ab-fill');
        const pct = abilityCooldownPct(key);
        if (fill) fill.style.transform = `translateY(${pct * 100}%)`;
        btn.classList.toggle('ready', pct === 0);
    });
}

function triggerBurst() {
    if (state.burst.cooldown > 0) return;

    state.burst.active = true;
    state.burst.radius = 0;
    state.burst.x = state.player.x;
    state.burst.y = state.player.y;
    state.burst.cooldown = state.burst.maxCooldown;

    playTone(300, 'square', 0.1, 0.3);
    playTone(600, 'sine', 0.4, 0.2);

    const burstEl = document.createElement('div');
    burstEl.className = 'radiant-burst';
    burstEl.style.left = `${state.burst.x}px`;
    burstEl.style.top = `${state.burst.y}px`;
    entitiesLayer.appendChild(burstEl);

    let frames = 0;
    const animateBurst = () => {
        frames++;
        state.burst.radius = (frames / 20) * state.burst.maxRadius;
        burstEl.style.width = `${state.burst.radius * 2}px`;
        burstEl.style.height = `${state.burst.radius * 2}px`;
        burstEl.style.opacity = 1 - (frames / 20);

        // Detect spirit hits
        state.voidSpirits.forEach(s => {
            const dx = s.x - state.burst.x;
            const dy = s.y - state.burst.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < state.burst.radius + 20 && !s.dispelling) {
                s.dispelling = true;
                playTone(800, 'sine', 0.2, 0.2);
            }
        });

        if (frames < 20) {
            requestAnimationFrame(animateBurst);
        } else {
            burstEl.remove();
            state.burst.active = false;

            // Radiant Echo bonus: Trigger a second burst after a short delay
            if (state.sparkUpgrades.radiant_echo && !state.burst.isEcho) {
                setTimeout(() => {
                    const originalCooldown = state.burst.cooldown;
                    state.burst.cooldown = 0;
                    state.burst.isEcho = true;
                    triggerBurst();
                    state.burst.isEcho = false;
                    state.burst.cooldown = originalCooldown; // Keep the original cooldown
                }, 400);
            }
        }
    };
    requestAnimationFrame(animateBurst);
}

function spawnVoidSpirit() {
    // Prevent spawning if tab is inactive
    if (document.hidden) return;

    // Only spawn spirits if player has reached Area 3+ or has high motes
    if (state.level < 2 && state.motes < 1000) return;

    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * state.world.width; y = -50; }
    else if (side === 1) { x = Math.random() * state.world.width; y = state.world.height + 50; }
    else if (side === 2) { x = -50; y = Math.random() * state.world.height; }
    else { x = state.world.width + 50; y = Math.random() * state.world.height; }

    const id = `spirit-${Date.now()}`;
    const el = document.createElement('div');
    const type = state.activeSpiritType || 'glimmer';
    el.className = `void-spirit spirit-${type}`;
    el.id = id;
    el.innerHTML = '<div class="spirit-core"></div>';
    entitiesLayer.appendChild(el);

    // v3.0: derive biome at spawn time (fixes out-of-scope `biome` reference)
    const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
    const activeThreshold = thresholds.find(t => state.level >= t) || 1;
    const currentBiome = biomes[activeThreshold];

    state.voidSpirits.push({
        id, x, y, el, type,
        dispelling: false,
        speed: (1 + Math.random() * 1.4) * currentBiome.spiritSpeed,
        lastPulse: Date.now()
    });
}

function spawnShreds(x, y) {
    for (let i = 0; i < 2; i++) {
        const id = `shred-${Date.now()}-${i}`;
        const el = document.createElement('div');
        el.className = 'void-spirit spirit-shred';
        el.id = id;
        el.innerHTML = '<div class="spirit-core"></div>';
        entitiesLayer.appendChild(el);

        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * 30;
        const vy = Math.sin(angle) * 30;

        state.voidSpirits.push({
            id, x: x + vx, y: y + vy, el, type: 'glimmer',
            isShred: true,
            dispelling: false,
            speed: 3 + Math.random() * 2
        });
    }
}

function triggerFlarePulse(spirit) {
    const pulse = document.createElement('div');
    pulse.className = 'flare-pulse';
    pulse.style.left = `${spirit.x}px`;
    pulse.style.top = `${spirit.y}px`;
    entitiesLayer.appendChild(pulse);

    // Animate and remove pulse
    setTimeout(() => pulse.remove(), 1000);

    // Find nearest tree tether source
    let nearestTree = null;
    let minDist = 300;

    state.entities.forEach(ent => {
        if (ent.type === 'tree') {
            const dx = ent.x - spirit.x;
            const dy = ent.y - spirit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearestTree = ent;
            }
        }
    });

    if (nearestTree) {
        nearestTree.slowedUntil = Date.now() + 5000;
        // Visual indicator on tree
        const treeEl = document.getElementById(nearestTree.id);
        if (treeEl) {
            treeEl.classList.add('tree-slowed');
            setTimeout(() => treeEl.classList.remove('tree-slowed'), 5000);
        }
    }
}

function updateSpirits() {
    const threatenedPoints = []; // List of points companions should move toward

    state.voidSpirits = state.voidSpirits.filter(s => {
        if (s.dispelling) {
            s.el.style.opacity = parseFloat(s.el.style.opacity || 1) - 0.1;
            if (parseFloat(s.el.style.opacity) <= 0) {
                // Codex: record on actual dispel completion (one entry per kill, not per shred)
                if (!s.isShred && s.type) recordCodexEncounter('spirits', s.type);
                // Handle Shade splitting on death
                if (s.type === 'shade' && !s.isShred) {
                    spawnShreds(s.x, s.y);
                }
                s.el.remove();
                return false;
            }
            return true;
        }

        // Check for collision with tethers
        let damagedTether = false;
        for (let i = 0; i < state.tethers.length; i++) {
            const t = state.tethers[i];
            // Use cached coordinates if available
            const x1 = t.x1 || 0, y1 = t.y1 || 0, x2 = t.x2 || 0, y2 = t.y2 || 0;

            // Fast bounding box check (optional but helper)
            const minX = Math.min(x1, x2) - 30;
            const maxX = Math.max(x1, x2) + 30;
            const minY = Math.min(y1, y2) - 30;
            const maxY = Math.max(y1, y2) + 30;

            if (s.x > minX && s.x < maxX && s.y > minY && s.y < maxY) {
                const dist = getDistToSegment(s.x, s.y, x1, y1, x2, y2);
                if (dist < 25) {
                    // v3.1 Warded tethers absorb the hit and dispel the spirit
                    if (t.wardedUntil && Date.now() < t.wardedUntil) {
                        s.dispelling = true;
                        playTone(900, 'sine', 0.3, 0.15);
                        break;
                    }
                    t.health -= 5;
                    s.dispelling = true;
                    damagedTether = true;
                    playTone(200, 'sine', 0.2, 0.1);
                    if (t.health <= 0) {
                        state.remnants.push({
                            sourceId: t.sourceId,
                            targetId: t.targetId,
                            maxHealth: t.maxHealth
                        });
                        state.tethers.splice(i, 1);
                        playTone(100, 'sawtooth', 0.4, 0.5);
                        renderTethers();
                    }
                    break; // Exit tether loop for this spirit
                } else if (dist < 250) {
                    // Spirit is a threat to this tether, mark for companions
                    threatenedPoints.push({ x: s.x, y: s.y, spirit: s });
                }
            }
        }

        if (damagedTether) return true;

        // v3.1 Frozen by Chrono-Pulse — don't move this frame
        if (s.frozenUntil && Date.now() < s.frozenUntil) {
            if (s.el) s.el.classList.add('spirit-frozen');
            return true;
        } else if (s.el) {
            s.el.classList.remove('spirit-frozen');
        }

        // Move toward player OR nearest tree (tether source)
        let targetX = state.player.x;
        let targetY = state.player.y;
        let distSq = Math.pow(s.x - targetX, 2) + Math.pow(s.y - targetY, 2);

        // Depth Creeper: Speed boost when far from player
        let currentSpeed = s.speed;
        if (s.type === 'creeper' && distSq > 250000) { // > 500 units
            currentSpeed *= 1.8;
        }

        // Solar Flare: Periodic pulse to slow tree regrowth
        if (s.type === 'flare' && !s.isShred && Date.now() - s.lastPulse > 4000) {
            triggerFlarePulse(s);
            s.lastPulse = Date.now();
        }

        let minSqDist = distSq;

        for (const t of state.tethers) {
            const dSq = Math.pow(s.x - (t.x1 || 0), 2) + Math.pow(s.y - (t.y1 || 0), 2);
            if (dSq < minSqDist) { minSqDist = dSq; targetX = t.x1; targetY = t.y1; }
        }

        const dx = targetX - s.x;
        const dy = targetY - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            s.x += (dx / dist) * currentSpeed;
            s.y += (dy / dist) * currentSpeed;
        }

        s.el.style.left = `${s.x - 20}px`;
        s.el.style.top = `${s.y - 20}px`;

        // Collision with player
        if (dist < 30 && targetX === state.player.x) {
            let damage = state.sparkUpgrades.void_shield ? 2 : 5;
            if (state.sparkUpgrades.void_aegis) damage = Math.ceil(damage * 0.4); // 60% reduction
            state.pods = Math.max(0, state.pods - damage);
            s.dispelling = true;
            playTone(150, 'sawtooth', 0.3, 0.4, true);
            updateHUD();
        }

        return true;
    });

    state._threats = threatenedPoints; // Store for updateCompanions
}

function updateRemnants() {
    state.remnants = state.remnants.filter(r => {
        const src = state.entities.find(e => e.id === r.sourceId);
        if (!src) return false;

        const dist = Math.sqrt(Math.pow(state.player.x - src.x, 2) + Math.pow(state.player.y - src.y, 2));
        if (dist < 60) {
            // Recover tether
            state.tethers.push({
                sourceId: r.sourceId,
                targetId: r.targetId,
                health: r.maxHealth * 0.5, // Recover with 50% health
                maxHealth: r.maxHealth
            });
            playTone(800, 'sine', 0.5, 0.3);
            createHarvestParticle(src.x, src.y, true);
            renderTethers();
            return false;
        }
        return true;
    });
}

function getDistToSegment(px, py, x1, y1, x2, y2) {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
}

function spawnCompanionElement(companion) {
    if (!companion.variant) companion.variant = 'sentinel';
    const v = COMPANION_VARIANTS[companion.variant] || COMPANION_VARIANTS.sentinel;
    const el = document.createElement('div');
    el.className = `companion sentinel companion-${companion.variant} glass`;
    el.id = `companion-${companion.id}`;
    el.innerHTML = `<span class="companion-icon">${v.icon}</span><span class="companion-evolve-hint">⇡</span>`;
    el.style.position = 'absolute';
    el.style.width = '34px';
    el.style.height = '34px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.borderRadius = '50%';
    el.style.zIndex = '50';
    el.style.cursor = 'pointer';
    el.style.pointerEvents = 'auto';
    const glow = v.color === 'lime' ? 'var(--neon-lime)' : v.color === 'purple' ? 'var(--neon-purple)' : 'var(--neon-cyan)';
    el.style.boxShadow = `0 0 18px ${glow}`;
    el.style.border = `1px solid ${glow}`;
    el.onclick = (e) => { e.stopPropagation(); openCompanionEvolvePanel(companion.id); };
    entitiesLayer.appendChild(el);
    companion.el = el;
}

function openCompanionEvolvePanel(companionId) {
    const c = state.companions.find(co => co.id === companionId);
    if (!c) return;
    let panel = document.getElementById('companion-evolve-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'companion-evolve-panel';
        panel.className = 'overlay';
        panel.innerHTML = `
            <div class="overlay-content glass" style="max-width: 520px;">
                <header>
                    <h2>Evolve Companion</h2>
                    <button class="close-btn" id="close-companion-evolve">&times;</button>
                </header>
                <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
                    Choose a specialization. Costs <strong class="neon-gold">3 ⭐</strong>. Each companion can be re-evolved.
                </p>
                <div id="companion-evolve-options" class="achievement-list"></div>
            </div>`;
        document.body.appendChild(panel);
        panel.addEventListener('click', (e) => {
            if (e.target === panel) panel.classList.remove('active');
        });
        document.getElementById('close-companion-evolve').onclick = () => panel.classList.remove('active');
    }
    const opts = document.getElementById('companion-evolve-options');
    opts.innerHTML = '';
    ['sentinel', 'guardian', 'gatherer', 'scholar'].forEach(key => {
        const v = COMPANION_VARIANTS[key];
        const isCurrent = c.variant === key;
        const canAfford = state.starFragments >= 3 || isCurrent;
        const row = document.createElement('div');
        row.className = `achievement-row ${isCurrent ? 'unlocked' : ''}`;
        row.innerHTML = `
            <div class="ar-icon">${v.icon}</div>
            <div class="ar-text">
                <div class="ar-name">${v.name}${isCurrent ? ' • Current' : ''}</div>
                <div class="ar-desc">${v.desc}</div>
            </div>
            ${isCurrent
                ? `<span class="ar-reward claimed">Active</span>`
                : `<button class="ar-reward claimable" data-key="${key}" ${canAfford ? '' : 'disabled'}>3 ⭐</button>`}`;
        opts.appendChild(row);
    });
    opts.onclick = (e) => {
        const btn = e.target.closest('.ar-reward.claimable[data-key]');
        if (!btn) return;
        const key = btn.dataset.key;
        if (state.starFragments < 3) return;
        state.starFragments -= 3;
        c.variant = key;
        // Re-render companion DOM
        if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
        spawnCompanionElement(c);
        playLevelUpSound();
        updateHUD();
        openCompanionEvolvePanel(companionId); // refresh
        saveGame();
    };
    panel.classList.add('active');
}

function updateCompanions() {
    const threats = state._threats || [];

    state.companions.forEach((c, index) => {
        const variant = COMPANION_VARIANTS[c.variant || 'sentinel'];
        // AI Logic: Find nearest spirit from the threat list (already filtered)
        let targetSpirit = null;
        let minSqDist = variant.defenseRange * variant.defenseRange;

        for (const t of threats) {
            if (t.spirit.dispelling) continue;
            const dSq = Math.pow(c.x - t.x, 2) + Math.pow(c.y - t.y, 2);
            if (dSq < minSqDist) { minSqDist = dSq; targetSpirit = t.spirit; }
        }

        // Gatherer: passively harvest pods within range every tick
        if (variant.harvestRate > 0 && state.pods < state.player.maxPods) {
            for (const ent of state.entities) {
                if (ent.type === 'tree' && ent.subType !== 'star-tree' && ent.pods > 0.5) {
                    const dSq = Math.pow(c.x - ent.x, 2) + Math.pow(c.y - ent.y, 2);
                    if (dSq < 14400) { // within 120 units
                        const amt = Math.min(variant.harvestRate / 60, ent.pods, state.player.maxPods - state.pods);
                        ent.pods -= amt;
                        state.pods += amt;
                        state.stats.totalPodsHarvested += amt;
                        if (Math.random() > 0.97) createHarvestParticle(ent.x, ent.y);
                        break;
                    }
                }
            }
        }

        // Scholar: passively generate motes
        if (variant.moteBonus > 0) {
            const gain = variant.moteBonus / 60;
            state.motes += gain;
            state.stats.totalMotesEarned += gain;
        }

        // Idle Behavior: Patrol between active tethers or follow player
        let targetX = state.player.x;
        let targetY = state.player.y;

        if (targetSpirit) {
            targetX = targetSpirit.x;
            targetY = targetSpirit.y;
            // Collision with spirit
            if (minSqDist < 1600) { // 40^2
                targetSpirit.dispelling = true;
                playTone(600, 'sine', 0.2, 0.1);
            }
        } else if (state.activeBoss) {
            // No spirits to chase: harass the boss
            const b = state.activeBoss;
            targetX = b.x; targetY = b.y;
            const ddx = b.x - c.x, ddy = b.y - c.y;
            const dSqB = ddx * ddx + ddy * ddy;
            if (dSqB < 3600) { // within 60 units
                if (!c._bossHitAt || Date.now() - c._bossHitAt > 700) {
                    c._bossHitAt = Date.now();
                    damageBoss(0.5);
                }
            }
        } else if (state.tethers.length > 0) {
            const tetherIndex = (Math.floor(Date.now() / 3000) + index) % state.tethers.length;
            const t = state.tethers[tetherIndex];
            if (t.x1 !== undefined) {
                const angle = (Date.now() / 1000) + (index * Math.PI * 2 / state.companions.length);
                targetX = t.x1 + Math.cos(angle) * 60;
                targetY = t.y1 + Math.sin(angle) * 60;
            }
        } else {
            const angle = (Date.now() / 1000) + (index * Math.PI * 2 / state.companions.length);
            targetX = state.player.x + Math.cos(angle) * 50;
            targetY = state.player.y + Math.sin(angle) * 50;
        }

        const dx = targetX - c.x;
        const dy = targetY - c.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > 4) {
            const speed = targetSpirit ? 6 : 3;
            const dist = Math.sqrt(dSq);
            c.x += (dx / dist) * speed;
            c.y += (dy / dist) * speed;
        }

        if (c.el) {
            c.el.style.left = `${c.x - 15}px`;
            c.el.style.top = `${c.y - 15}px`;
        }
    });
}

// Initial spirit spawning setup is handled by updateBiome() during init calls
if (state.spiritIntervalId === null) {
    updateBiome();
}

if (burstBtn) burstBtn.addEventListener('click', () => { triggerBurst(); });
window.addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest('.hud, .actions, .overlay, .bottom-bar-container')) triggerBurst(); });

function updateBurstUI() {
    if (!burstFill) return;
    const pct = (state.burst.cooldown / state.burst.maxCooldown) * 100;
    burstFill.style.transform = `translateY(${pct}%)`;
}

loadGame(); ensureProfileInitialized(); tickDailyStreak(); initWorld(); updateHUD(); renderPlayerSprite(); updateDailyBanner(); update();
setTimeout(checkPatchNotesCallout, 1200); // brief delay so the menu animations land first

// v3.1 Cloud sync — best-effort boot routine (won't block the game if it fails)
(async () => {
    if (!isCloudEnabled()) return;
    await cloudUpsertPlayer();
    // If cloud save is newer than the local save, pull it
    try {
        const localRaw = localStorage.getItem('lushHarvestSave');
        const localTs = localRaw ? (JSON.parse(localRaw).lastModified || 0) : 0;
        const cloud = await cloudPullSave();
        if (cloud && cloud.data) {
            const cloudTs = cloud.data.lastModified || new Date(cloud.updated_at).getTime();
            if (cloudTs > localTs + 1000) { // 1s tolerance
                console.log(`[cloud] using cloud save (${new Date(cloudTs).toISOString()}) over local (${new Date(localTs).toISOString()})`);
                localStorage.setItem('lushHarvestSave', JSON.stringify(cloud.data));
                // Soft reload: re-run loadGame and refresh world
                loadGame(); initWorld(); updateHUD(); renderPlayerSprite(); updateDailyBanner();
            }
        }
    } catch (e) { console.warn('[cloud] boot sync failed', e); }
    // Update profile UI if it's open
    if (document.getElementById('profile-panel')?.classList.contains('active')) renderProfile();
})();
// Wire daily banner exit button (banner element is in DOM at this point)
const dailyExitBtn = document.getElementById('daily-exit-btn');
if (dailyExitBtn) dailyExitBtn.addEventListener('click', () => exitDailyToMain());

// Handle Shop Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        activeUpgradeTab = btn.dataset.currency;
        renderUpgrades();
    };
});

// Handle Boost Toggle UI
document.getElementById('boosts-toggle').onclick = () => {
    document.getElementById('boosts-panel').classList.add('active');
};
document.getElementById('close-boosts').onclick = () => {
    document.getElementById('boosts-panel').classList.remove('active');
};

// Handle Boost Buttons
document.querySelectorAll('.boost-btn').forEach(btn => {
    btn.onclick = () => {
        // AdSense Integration Point
        if (window.adsbygoogle) {
            console.log("AdSense detected. Attempting to show rewarded ad...");
            // Placeholder for Google H5 Games API or standard AdSense
            // On success, call applyBoost(btn.dataset.boost);
        }
        showRewardedAd(btn.dataset.boost);
    };
});

function showRewardedAd(type) {
    const overlay = document.getElementById('ad-mock-overlay');
    const adProgress = document.getElementById('ad-progress');
    const adTimer = document.getElementById('ad-timer');

    overlay.classList.add('active');
    let timeLeft = 3; // 3 second mock ad
    adProgress.style.width = '0%';
    adTimer.innerText = `${timeLeft}s remaining`;

    const interval = setInterval(() => {
        timeLeft -= 0.1;
        const progress = ((3 - timeLeft) / 3) * 100;
        adProgress.style.width = `${progress}%`;
        adTimer.innerText = `${Math.ceil(timeLeft)}s remaining`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            overlay.classList.remove('active');
            applyBoost(type);
            document.getElementById('boosts-panel').classList.remove('active');
        }
    }, 100);
}

function applyBoost(type) {
    if (type === 'mote_2x') {
        state.boosts.active['mote_2x'] = 300; // 5 mins
    } else if (type === 'speed_1.5x') {
        state.boosts.active['speed_1.5x'] = 300;
    } else if (type === 'refill_all') {
        state.entities.forEach(e => {
            if (e.type === 'tree') {
                e.pods = (e.subType === 'star-tree') ? 1 : 10;
            }
        });
        playTone(800, 'sine', 0.5, 0.4);
    }
    refreshMultipliers();
    saveGame();
}

function refreshMultipliers() {
    state.boosts.moteMultiplier = state.boosts.active['mote_2x'] ? 2 : 1;
    state.boosts.speedMultiplier = state.boosts.active['speed_1.5x'] ? 1.5 : 1;
}

function updateBoosts() {
    const container = document.getElementById('buff-container');
    if (!container) return;

    // Collect all active buffs
    let activeBuffs = [];

    // 1. Check shrine buff (state.buffs)
    if (state.buffs.active && state.buffs.timer > 0) {
        activeBuffs.push({
            id: 'shrine_mote_2x',
            icon: '🌸',
            name: 'Shrine Blessing',
            timer: state.buffs.timer
        });
        state.buffs.timer--;
        if (state.buffs.timer <= 0) state.buffs.active = false;
    }

    // 2. Check ad boosts (state.boosts.active)
    for (let boostKey in state.boosts.active) {
        if (state.boosts.active[boostKey] > 0) {
            state.boosts.active[boostKey]--;

            let icon = '✨';
            let name = 'Luminous Surge';
            if (boostKey === 'speed_1.5x') {
                icon = '💨';
                name = 'Solar Wind';
            }

            activeBuffs.push({
                id: boostKey,
                icon: icon,
                name: name,
                timer: state.boosts.active[boostKey]
            });
        } else {
            delete state.boosts.active[boostKey];
            refreshMultipliers();
        }
    }

    // Update UI
    container.innerHTML = '';
    activeBuffs.forEach(buff => {
        const bubble = document.createElement('div');
        bubble.className = 'buff-bubble glass';

        const mins = Math.floor(buff.timer / 60);
        const secs = Math.ceil(buff.timer % 60);
        const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;

        bubble.innerHTML = `
            <span class="icon">${buff.icon}</span>
            <span class="name">${buff.name}</span>
            <span class="timer">${timeStr}</span>
        `;
        container.appendChild(bubble);
    });

    if (activeBuffs.length > 0) {
        saveGame(); // Save timers
    }
}

// Tick boosts every second
setInterval(updateBoosts, 1000);

// Debug / Cheat Access
window.state = state;
window.updateHUD = updateHUD;
window.saveGame = saveGame;
window.startDailyChallenge = startDailyChallenge;
window.exitDailyToMain = exitDailyToMain;
window.endDailyChallenge = endDailyChallenge;
window.captureRunSnapshot = captureRunSnapshot;
window.applyRunSnapshot = applyRunSnapshot;
window.checkSaveIntegrity = () => {
    const raw = localStorage.getItem('lushHarvestSave');
    console.group("Save Data Diagnostic");
    console.log("Raw Length:", raw?.length || 0);
    try {
        const parsed = JSON.parse(raw);
        console.log("Parsed Version:", parsed.version);
        console.log("Motes in File:", parsed.motes);
        console.log("Upgrades in File:", parsed.upgrades?.length || 0);
        console.log("Entities in File:", parsed.entities?.length || 0);
    } catch (e) {
        console.error("Save Corrupted or Missing:", e);
    }
    console.groupEnd();
};

// Multi-tab Sync
window.addEventListener('storage', (e) => {
    if (e.key === 'lushHarvestSave' && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            if (data && data.instanceId !== state.instanceId) {
                console.log(`Syncing progress from Tab ${data.instanceId}...`);
                loadGame();
            }
        } catch (err) {
            console.warn("Storage sync failed:", err);
        }
    }
});
