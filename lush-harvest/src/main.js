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
    { id: 'astral_attunement', name: 'Astral Attunement', description: '+20% base Mote gain', cost: 1, x: 50, y: 20, req: null, icon: '✨' },
    { id: 'luminous_stride', name: 'Luminous Stride', description: '+15% Move Speed', cost: 2, x: 25, y: 50, req: 'astral_attunement', icon: '👟' },
    { id: 'celestial_pockets', name: 'Celestial Pockets', description: '+50 Max Pods', cost: 2, x: 50, y: 50, req: 'astral_attunement', icon: '🎒' },
    { id: 'tether_mastery', name: 'Tether Mastery', description: 'Tethers 25% faster', cost: 3, x: 75, y: 50, req: 'astral_attunement', icon: '🔗' },
    { id: 'radiant_echo', name: 'Radiant Echo', description: 'Burst triggers twice', cost: 5, x: 25, y: 80, req: 'luminous_stride', icon: '🔊' },
    { id: 'starlight_harvest', name: 'Starlight Harvest', description: 'Trees regrow +20%', cost: 4, x: 75, y: 80, req: 'tether_mastery', icon: '🌟' },
    { id: 'void_shield', name: 'Void Shield', description: 'Resist 1 spirit hit', cost: 6, x: 50, y: 80, req: 'celestial_pockets', icon: '🛡️' }
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
        screenshake: true
    },
    buildMode: { active: false, sourceId: null, targetId: null },
    buffs: {
        active: false,
        timer: 0
    },
    companions: [],
    voidSpirits: [],
    remnants: [],
    activeSpiritType: null,
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
    upgrades: [
        { id: 'speed', name: 'Swift Essence', description: 'Increase movement speed', basePrice: 20, priceMult: 1.6, level: 0, effect: (lvl) => 4 + (lvl * 0.8), currency: 'motes' },
        { id: 'harvest', name: 'Resonant Aura', description: 'Wider harvesting range', basePrice: 50, priceMult: 1.5, level: 0, effect: (lvl) => 80 + (lvl * 20), currency: 'motes' },
        { id: 'capacity', name: 'Void Pouch', description: 'Hold more Spore Pods', basePrice: 30, priceMult: 1.5, level: 0, effect: (lvl) => 20 + (lvl * 10), currency: 'motes' },
        { id: 'forge_speed', name: 'Forge Resonance', description: 'Faster pod conversion', basePrice: 40, priceMult: 1.6, level: 0, effect: (lvl) => 0.5 + (lvl * 0.25), currency: 'motes' },
        { id: 'regrowth', name: 'Nature\'s Bounty', description: 'Trees regrow faster', basePrice: 60, priceMult: 1.7, level: 0, effect: (lvl) => 0.005 + (lvl * 0.002), currency: 'motes' },
        { id: 'wisp', name: 'Luminous Companion', description: 'Auto-harvests pods nearby', basePrice: 80, priceMult: 2.0, level: 0, effect: (lvl) => lvl, currency: 'motes' },
        { id: 'light_weaver', name: 'Light Weaver', description: 'Unlock Light Tethers to automate harvesting', basePrice: 3, priceMult: 1.5, level: 0, effect: (lvl) => lvl, currency: 'starFragments' },
        { id: 'star_blessing', name: 'Stellar Blessing', description: 'Increases all Mote gains', basePrice: 5, priceMult: 1.8, level: 0, effect: (lvl) => 1 + (lvl * 0.5), currency: 'starFragments' },
        { id: 'mote_magnet', name: 'Mote Magnet', description: 'Automatically pull motes from further away', basePrice: 150, priceMult: 2.0, level: 0, effect: (lvl) => 120 + (lvl * 30), currency: 'motes' },
        { id: 'crit_harvest', name: 'Critical Bloom', description: 'Chance to get double pods', basePrice: 200, priceMult: 2.2, level: 0, effect: (lvl) => lvl * 0.05, currency: 'motes' },
        { id: 'sentinel', name: 'Void Sentinel', description: 'A defensive orb that dispels spirits attacking tethers.', basePrice: 10, priceMult: 2.5, level: 0, effect: (lvl) => lvl, currency: 'starFragments' }
    ],
    cosmetics: [
        { id: 'default', name: 'Spark', icon: '✨', price: 0, unlocked: true },
        { id: 'butterfly', name: 'Faerie', icon: '🦋', price: 1000, unlocked: false },
        { id: 'fairy', name: 'Sprite', icon: '🧚', price: 5000, unlocked: false },
        { id: 'lantern', name: 'Lantern', icon: '🏮', price: 10, currency: 'starFragments', unlocked: false }
    ],
    entityMap: {} // $O(1)$ lookup cache
};

// Objective Definitions
function getLevelObjective(level) {
    const objectives = [
        { type: 'collect_motes', target: 50, desc: 'Gather Motes' }, // Level 1
        { type: 'harvest_pods', target: 100, desc: 'Harvest Spore Pods' }, // Level 2
        { type: 'buy_upgrades', target: 2, desc: 'Purchase Mystic Upgrades' }, // Level 3
        { type: 'collect_motes', target: 500, desc: 'Gather Motes' }, // Level 4
        { type: 'harvest_pods', target: 300, desc: 'Harvest Spore Pods' } // Level 5
    ];
    // Default to scaling mote collection if beyond defined levels
    if (level <= objectives.length) {
        return objectives[level - 1];
    } else {
        return { type: 'collect_motes', target: 500 * Math.pow(1.5, level - 5), desc: 'Gather Motes' };
    }
}

function getObjectiveProgress(objective) {
    switch (objective.type) {
        case 'collect_motes': return Math.floor(state.motes);
        case 'harvest_pods': return Math.floor(state.stats.totalPodsHarvested);
        case 'buy_upgrades': return state.stats.upgradesBoughtThisLevel;
        default: return 0;
    }
}

const biomes = {
    1: { name: 'Ethereal Grove', bg: '#0f0524', accent: '#bc00ff', spiritInterval: 12000, spiritSpeed: 1.0, regrowth: 1.0, bgmFreqs: [110, 164.81, 220] },
    6: { name: 'Bioluminescent Depths', bg: '#051b24', accent: '#00f2ff', spiritInterval: 10000, spiritSpeed: 1.3, regrowth: 0.9, bgmFreqs: [98, 146.83, 196] },
    11: { name: 'Radiant Hollows', bg: '#241a05', accent: '#ffd700', spiritInterval: 8000, spiritSpeed: 1.6, regrowth: 1.2, bgmFreqs: [130, 196, 261] },
    16: { name: 'The Void', bg: '#0a0a0a', accent: '#444444', spiritInterval: 6000, spiritSpeed: 2.2, regrowth: 0.7, bgmFreqs: [82.41, 123.47, 164.81] }
};

function updateBiome() {
    const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
    const activeThreshold = thresholds.find(t => state.level >= t) || 1;
    const biome = biomes[activeThreshold];

    // Visuals
    document.documentElement.style.setProperty('--bg-deep', biome.bg);
    document.documentElement.style.setProperty('--neon-purple', biome.accent);

    // Refresh background gradient
    const container = document.querySelector('.game-container');
    if (container) {
        container.style.background = `radial-gradient(circle at center, ${biome.bg} 0%, #000 100%)`;
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

function randomizeSpiritType() {
    const types = ['standard', 'creeper', 'flare', 'shade'];
    state.activeSpiritType = types[Math.floor(Math.random() * types.length)];
    console.log(`NEW SPIRIT THEME for Area ${state.level}: ${state.activeSpiritType}`);
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
        const isStar = Math.random() < 0.05 + (state.level * 0.01); // 5% + 1% per level
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
    
    if (!state.activeSpiritType) randomizeSpiritType();
    
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
            state.stats.upgradesBoughtThisLevel = 0;
            state.stats.totalPodsHarvested = 0;
            
            if (state.level % 5 === 1) {
                randomizeSpiritType();
            }

            state.world.width += 500;
            state.world.height += 500;
            state.player.x = state.world.width / 2;
            state.player.y = state.world.height / 2;

            state.entities = [];
            initWorld();
            reconnectTethers();
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

function renderEntity(entity) {
    const el = document.createElement('div');
    el.id = entity.id;
    el.className = entity.type === 'tree' ? 'source-tree' : 'light-forge';

    const offset = entity.type === 'tree' ? 40 : (entity.type === 'obstacle' ? 0 : 60);
    el.style.left = entity.type === 'obstacle' ? `${entity.x}px` : `${entity.x - offset}px`;
    el.style.top = entity.type === 'obstacle' ? `${entity.y}px` : `${entity.y - offset}px`;

    if (entity.type === 'tree') {
        if (entity.subType === 'star-tree') {
            el.innerHTML = `<div class="star-tree-glow"></div><div class="star-tree-icon">🌟</div>`;
        } else {
            el.innerHTML = `<div class="tree-glow"></div><div class="tree-icon">🌲</div>`;
        }
    } else if (entity.type === 'shrine') {
        el.innerHTML = `<div class="shrine-glow"></div><div class="shrine-icon">🏛️</div>`;
    } else if (entity.type === 'obstacle') {
        el.className += ` obstacle-${entity.subType}`;
        el.innerHTML = entity.subType === 'rock' ? '🪨' : '🌿';
    } else {
        el.innerHTML = `<div class="forge-glow"></div><div class="forge-icon">🔥</div><div class="forge-label">LIGHT FORGE</div>`;
    }
    entitiesLayer.appendChild(el);
}

function handleJoystickStart(e) {
    if (e.target.closest('.hud, .actions, .overlay, .close-btn, #objective-tracker, #burst-zone')) return;
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
    gameWorld.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px)`;

    // Update player sprite if needed
    const charSpriteEl = document.querySelector('.char-sprite');
    if (charSpriteEl && charSpriteEl.textContent !== state.player.sprite) {
        charSpriteEl.textContent = state.player.sprite;
    }

    checkInteractions();
    updateWisps();
    updateMinimap();
    updateSpirits();
    updateRemnants();
    updateCompanions();

    if (state.burst.cooldown > 0) {
        state.burst.cooldown--;
        updateBurstUI();
    }

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
            
            const finalRegrowthSlow = (entity.slowedUntil && entity.slowedUntil > Date.now()) ? 0.2 : 1.0;
            if (entity.slowedUntil && entity.slowedUntil < Date.now()) {
                entity.slowedUntil = null;
                const treeEl = document.getElementById(entity.id);
                if (treeEl) treeEl.classList.remove('tree-slowed');
            }

            if (entity.pods < maxCapacity && dist >= range) {
                // Fix: Separate star tree regrowth from normal pods
                if (entity.subType === 'star-tree') {
                    // Star fragments regrow much slower and aren't tied to normal regrowth rate
                    entity.pods = Math.min(maxCapacity, entity.pods + (0.0001 * regrowthBonus * finalRegrowthSlow));
                } else {
                    entity.pods = Math.min(maxCapacity, entity.pods + (regrowthRate * regrowthBonus * biome.regrowth * finalRegrowthSlow));
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
                    playHarvestSound();
                    addCombo();
                    triggerShake();
                    updateHUD('stars');
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
                    updateHUD('pods');
                    updateHUD();
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
                    const sparkMulti = 1 + (state.sparks * 0.1) + (state.sparkUpgrades.astral_attunement ? 0.2 : 0);

                    state.pods -= sellAmount;
                    const gained = sellAmount * moteMultiplier * buffMulti * sparkMulti * state.boosts.moteMultiplier;
                    state.motes += gained;
                    state.stats.totalMotesEarned += gained;

                    if (Math.random() > 0.70) createSellParticle(state.player.x, state.player.y, entity.x, entity.y);
                    if (Math.random() > 0.5) playSellSound(); // Reduce frequency
                    updateHUD();
                }
            } else {
                el.style.filter = ''; el.style.transform = `scale(1)`;
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
    const sparkMulti = 1 + (state.sparks * 0.1) + (state.sparkUpgrades.astral_attunement ? 0.2 : 0);
    const tetherBonus = 1 + (state.sparkUpgrades.tether_mastery ? 0.25 : 0);

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
            const desiredLabel = state.buildMode.active ? (state.buildMode.sourceId ? "SELECT FORGE" : "SELECT TREE") : "TETHER";
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

        card.innerHTML = `<div><h3>${upgrade.name} (Lv. ${upgrade.level})</h3><p>${upgrade.description}</p></div><button class="upgrade-btn" style="${upgrade.currency === 'starFragments' ? 'background: #b8860b;' : ''}" ${canAfford && !isLimitReached ? '' : 'disabled'} data-id="${upgrade.id}">${btnText}</button>`;
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
    const speedBonus = 1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0);
    const capBonus = state.sparkUpgrades.celestial_pockets ? 50 : 0;

    if (upgrade.id === 'speed') state.player.speed = upgrade.effect(upgrade.level) * speedBonus;
    else if (upgrade.id === 'capacity') state.player.maxPods = upgrade.effect(upgrade.level) + capBonus;
    else if (upgrade.id === 'sentinel') {
        const newCompanion = { id: Date.now(), x: state.player.x, y: state.player.y };
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

        if (cosmetic.unlocked) {
            card.innerHTML = `
                <div class="cosmetic-icon">${cosmetic.icon}</div>
                <h3>${cosmetic.name}</h3>
                <button class="upgrade-btn cosmetic-btn" data-id="${cosmetic.id}" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Equipped' : 'Equip'}</button>
            `;
        } else {
            card.innerHTML = `
                <div class="cosmetic-icon" style="filter: grayscale(1) opacity(0.5);">${cosmetic.icon}</div>
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
    return Math.floor(state.stats.totalMotesEarned / 5000);
}

function handleAscend() {
    const reward = calculateSparksReward();
    state.sparks += reward;
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
    astralUpgrades.forEach(upg => {
        const level = state.sparkUpgrades[upg.id] || 0;
        const isPurchased = level > 0;
        const isAvailable = !isPurchased && (!upg.req || state.sparkUpgrades[upg.req] > 0);
        const isLocked = !isPurchased && !isAvailable;

        const node = document.createElement('div');
        node.className = `astral-node ${isPurchased ? 'purchased' : (isAvailable ? 'available' : 'locked')}`;
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

const SAVE_VERSION = 2.4;

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

buildToggle.addEventListener('click', () => {
    const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
    if (state.tethers.length >= weaverLevel && !state.buildMode.active) return; // Prevent activation if maxed

    if (!state.buildMode.active) {
        state.buildMode.active = true;
        state.buildMode.sourceId = null;
        updateHUD();
    } else {
        if (!state.buildMode.sourceId) {
            let closestTree = null;
            let minDist = 150;
            for (const e of state.entities) {
                if (e.type === 'tree' && e.subType !== 'star-tree') {
                    const dist = Math.sqrt(Math.pow(e.x - state.player.x, 2) + Math.pow(e.y - state.player.y, 2));
                    if (dist < minDist) { minDist = dist; closestTree = e; }
                }
            }
            if (closestTree) {
                if (state.tethers.find(t => t.sourceId === closestTree.id)) {
                    const label = buildToggle.querySelector('.btn-label');
                    if (label) label.textContent = "ALREADY TETHERED!";
                    setTimeout(updateHUD, 1000);
                    state.buildMode.active = false;
                    return;
                }
                state.buildMode.sourceId = closestTree.id;
                playTone(600, 'sine', 0.2, 0.4);
                updateHUD();
            } else {
                state.buildMode.active = false;
                updateHUD();
            }
        } else {
            const forge = state.entities.find(e => e.type === 'forge');
            const dist = Math.sqrt(Math.pow(forge.x - state.player.x, 2) + Math.pow(forge.y - state.player.y, 2));
            if (dist < 200) {
                state.tethers.push({
                    sourceId: state.buildMode.sourceId,
                    targetId: forge.id,
                    health: 100,
                    maxHealth: 100
                });
                state.buildMode.active = false;
                renderTethers();
                playTone(800, 'sine', 0.5, 0.5);
                updateHUD();
                saveGame();
            } else {
                state.buildMode.active = false;
                updateHUD();
            }
        }
    }
});

cosmeticsToggle.addEventListener('click', () => { renderCosmetics(); cosmeticsPanel.classList.add('active'); });
closeCosmetics.addEventListener('click', () => cosmeticsPanel.classList.remove('active'));
cosmeticList.addEventListener('click', (e) => { if (e.target.classList.contains('cosmetic-btn')) handleCosmeticClick(e.target.dataset.id); });

settingsToggle.addEventListener('click', () => settingsPanel.classList.add('active'));
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

    startGameBtn.onclick = () => {
        initAudio();
        mainMenu.classList.remove('active');
        if (state.level === 1 && state.motes === 0 && state.pods === 0) {
            // First time play hook if needed
        }
    };
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
    
    const activeType = state.activeSpiritType || 'standard';
    let addedClass = '';
    if (activeType === 'creeper') addedClass = 'spirit-creeper';
    if (activeType === 'flare') addedClass = 'spirit-flare';
    if (activeType === 'shade') addedClass = 'spirit-shade';

    el.className = `void-spirit ${addedClass}`;
    el.id = id;
    el.innerHTML = '<div class="spirit-core"></div>';
    entitiesLayer.appendChild(el);

    const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
    const activeThreshold = thresholds.find(t => state.level >= t) || 1;
    const biome = biomes[activeThreshold];

    state.voidSpirits.push({ 
        id, 
        x, 
        y, 
        el, 
        dispelling: false, 
        speed: (1 + Math.random() * 1.5) * biome.spiritSpeed,
        type: activeType,
        flareTimer: activeType === 'flare' ? 120 + Math.random() * 60 : 0
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
        
        state.voidSpirits.push({
            id,
            x: x + (Math.random() * 40 - 20),
            y: y + (Math.random() * 40 - 20),
            el,
            dispelling: false,
            speed: 5 + Math.random() * 2,
            type: 'shade',
            isShred: true
        });
    }
}

function triggerFlarePulse(x, y) {
    playTone(200, 'square', 0.2, 0.4);
    const pulseEl = document.createElement('div');
    pulseEl.className = 'flare-pulse';
    pulseEl.style.left = `${x}px`;
    pulseEl.style.top = `${y}px`;
    entitiesLayer.appendChild(pulseEl);
    
    setTimeout(() => pulseEl.remove(), 1500);

    const pulseRadius = 150;
    state.entities.forEach(e => {
        if (e.type === 'tree') {
            const dist = Math.sqrt(Math.pow(e.x - x, 2) + Math.pow(e.y - y, 2));
            if (dist < pulseRadius) {
                e.slowedUntil = Date.now() + 5000;
                const treeEl = document.getElementById(e.id);
                if (treeEl) treeEl.classList.add('tree-slowed');
            }
        }
    });
}

function updateSpirits() {
    const threatenedPoints = []; // List of points companions should move toward

    state.voidSpirits = state.voidSpirits.filter(s => {
        if (s.dispelling) {
            s.el.style.opacity = parseFloat(s.el.style.opacity || 1) - 0.1;
            if (parseFloat(s.el.style.opacity) <= 0) {
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

        if (damagedTether) return true;

        // Flare Pulse Logic
        if (s.type === 'flare' && !s.dispelling) {
            s.flareTimer--;
            if (s.flareTimer <= 0) {
                triggerFlarePulse(s.x, s.y);
                s.flareTimer = 180 + Math.random() * 60; // 3-4 seconds
            }
        }

        // Creeper Speed Logic
        let currentSpeed = s.speed;
        if (s.type === 'creeper') {
            const distToPlayer = Math.sqrt(Math.pow(s.x - state.player.x, 2) + Math.pow(s.y - state.player.y, 2));
            if (distToPlayer > 500) currentSpeed *= 2.5;
        }

        // Move toward player OR nearest tree (tether source)
        let targetX = state.player.x;
        let targetY = state.player.y;
        let minSqDist = Math.pow(s.x - targetX, 2) + Math.pow(s.y - targetY, 2);

        for (const t of state.tethers) {
            const dSq = Math.pow(s.x - (t.x1 || 0), 2) + Math.pow(s.y - (t.y1 || 0), 2);
            if (dSq < minSqDist) { minSqDist = dSq; targetX = t.x1; targetY = t.y1; }
        }

        const dx = targetX - s.x;
        const dy = targetY - s.y;
        const dist = Math.sqrt(minSqDist);
        if (dist > 1) {
            s.x += (dx / dist) * currentSpeed;
            s.y += (dy / dist) * currentSpeed;
        }

        s.el.style.left = `${s.x - 20}px`;
        s.el.style.top = `${s.y - 20}px`;

        // Collision with player
        if (dist < 30 && targetX === state.player.x) {
            const damage = state.sparkUpgrades.void_shield ? 2 : 5;
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
    const el = document.createElement('div');
    el.className = 'companion sentinel glass';
    el.id = `companion-${companion.id}`;
    el.innerHTML = '🛡️';
    el.style.position = 'absolute';
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.borderRadius = '50%';
    el.style.zIndex = '50';
    el.style.pointerEvents = 'none';
    el.style.boxShadow = '0 0 15px var(--neon-cyan)';
    entitiesLayer.appendChild(el); // FIXED: Changed from world to entitiesLayer
    companion.el = el;
}

function updateCompanions() {
    const threats = state._threats || [];

    state.companions.forEach((c, index) => {
        // AI Logic: Find nearest spirit from the threat list (already filtered)
        let targetSpirit = null;
        let minSqDist = 160000; // 400^2

        for (const t of threats) {
            if (t.spirit.dispelling) continue;
            const dSq = Math.pow(c.x - t.x, 2) + Math.pow(c.y - t.y, 2);
            if (dSq < minSqDist) { minSqDist = dSq; targetSpirit = t.spirit; }
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

loadGame(); initWorld(); updateHUD(); update();

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
