// Web Audio API Sound Generation
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let bgmOscillators = [];
let isAudioInitialized = false;
let isBgmPlaying = false;
let masterGain = null;

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
        masterGain.gain.value = 0.3; // Global volume
        masterGain.connect(audioCtx.destination);
        isAudioInitialized = true;
        startBGM();
    } catch (e) {
        console.error("Audio initialization failed:", e);
    }
}

function playTone(freq, type, duration, vol, sweep = false) {
    if (!isAudioInitialized) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.connect(gain);
    gain.connect(masterGain);

    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (sweep) {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playHarvestSound() {
    playTone(600 + Math.random() * 200, 'sine', 0.1, 0.4);
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
        gain.connect(masterGain);

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
    buildMode: { active: false, sourceId: null, targetId: null },
    buffs: {
        active: false,
        timer: 0
    },
    voidSpirits: [],
    spiritIntervalId: null,
    burst: { active: false, x: 0, y: 0, radius: 0, maxRadius: 160, cooldown: 0, maxCooldown: 120 },
    stats: {
        totalPodsHarvested: 0,
        totalStarsHarvested: 0,
        totalMotesEarned: 0,
        upgradesBoughtThisLevel: 0
    },
    player: {
        x: 1000,
        y: 1000,
        speed: 4,
        radius: 20,
        maxPods: 20,
        sprite: '✨'
    },
    world: { width: 2000, height: 2000 },
    camera: { x: 0, y: 0, lerp: 0.1 },
    joystick: { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0, vector: { x: 0, y: 0 } },
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false },
    isTouch: false,
    entities: [],
    upgrades: [
        { id: 'speed', name: 'Swift Essence', description: 'Increase movement speed', basePrice: 20, priceMult: 1.6, level: 0, effect: (lvl) => 4 + (lvl * 0.8) },
        { id: 'harvest', name: 'Resonant Aura', description: 'Wider harvesting range', basePrice: 50, priceMult: 1.5, level: 0, effect: (lvl) => 80 + (lvl * 20) },
        { id: 'capacity', name: 'Void Pouch', description: 'Hold more Spore Pods', basePrice: 30, priceMult: 1.5, level: 0, effect: (lvl) => 20 + (lvl * 10) },
        { id: 'forge_speed', name: 'Forge Resonance', description: 'Faster pod conversion', basePrice: 40, priceMult: 1.6, level: 0, effect: (lvl) => 0.5 + (lvl * 0.25) },
        { id: 'regrowth', name: 'Nature\'s Bounty', description: 'Trees regrow faster', basePrice: 60, priceMult: 1.7, level: 0, effect: (lvl) => 0.005 + (lvl * 0.002) },
        { id: 'wisp', name: 'Luminous Companion', description: 'Auto-harvests pods nearby', basePrice: 80, priceMult: 2.0, level: 0, effect: (lvl) => lvl },
        { id: 'light_weaver', name: 'Light Weaver', description: 'Unlock Light Tethers to automate harvesting', basePrice: 3, priceMult: 1.5, level: 0, effect: (lvl) => lvl, currency: 'starFragments' },
        { id: 'star_blessing', name: 'Stellar Blessing', description: 'Increases all Mote gains', basePrice: 5, priceMult: 1.8, level: 0, effect: (lvl) => 1 + (lvl * 0.5), currency: 'starFragments' }
    ],
    cosmetics: [
        { id: 'default', name: 'Spark', icon: '✨', price: 0, unlocked: true },
        { id: 'butterfly', name: 'Faerie', icon: '🦋', price: 1000, unlocked: false },
        { id: 'fairy', name: 'Sprite', icon: '🧚', price: 5000, unlocked: false },
        { id: 'lantern', name: 'Lantern', icon: '🏮', price: 10, currency: 'starFragments', unlocked: false }
    ]
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
    renderTethers();
}

function advanceLevel() {
    const objective = getLevelObjective(state.level);
    const progress = getObjectiveProgress(objective);

    if (progress >= objective.target) {
        // Deduct motes if it was a mote objective (legacy behavior)
        if (objective.type === 'collect_motes') {
            state.motes -= objective.target;
        }

        state.level++;
        state.stats.upgradesBoughtThisLevel = 0; // Reset level-specific stats
        state.stats.totalPodsHarvested = 0; // Reset for the next harvest challenge to be fair

        state.world.width += 500;
        state.world.height += 500;
        state.player.x = state.world.width / 2;
        state.player.y = state.world.height / 2;

        state.entities = [];
        initWorld();
        reconnectTethers();
        updateWorldColors();
        updateHUD();
        playLevelUpSound();
        saveGame();
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
        document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
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
    if (astralPanel && !astralPanel.classList.contains('hidden')) {
        requestAnimationFrame(update);
        return;
    }

    const kbVector = getKeyboardVector();
    const finalVector = {
        x: state.joystick.active ? state.joystick.vector.x : kbVector.x,
        y: state.joystick.active ? state.joystick.vector.y : kbVector.y
    };

    const currentSpeed = state.player.speed * (state.buffs.active ? 2.0 : 1.0);

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

    if (state.burst.cooldown > 0) {
        state.burst.cooldown--;
        updateBurstUI();
    }

    requestAnimationFrame(update);
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
            if (entity.pods < maxCapacity && dist >= range) {
                const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
                const activeThreshold = thresholds.find(t => state.level >= t) || 1;
                const biome = biomes[activeThreshold];

                const regrowthBonus = 1 + (state.sparkUpgrades.starlight_harvest ? 0.2 : 0);
                entity.pods = Math.min(maxCapacity, entity.pods + regrowthRate * (entity.subType === 'star-tree' ? 0.1 : 1) * regrowthBonus * biome.regrowth);
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
                    updateHUD();
                } else if (entity.subType !== 'star-tree' && entity.pods > 0 && state.pods < state.player.maxPods) {
                    const amount = Math.min(0.1, entity.pods, state.player.maxPods - state.pods);
                    entity.pods -= amount;
                    state.pods += amount;
                    state.stats.totalPodsHarvested += amount; // Track stat
                    el.style.filter = `drop-shadow(0 0 20px var(--neon-cyan))`;
                    el.style.transform = `scale(1.1)`;
                    if (Math.random() > 0.90) createHarvestParticle(entity.x, entity.y);
                    if (Math.random() > 0.8) playHarvestSound(); // Don't play too often
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
                    const gained = sellAmount * moteMultiplier * buffMulti * sparkMulti;
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
    state.tethers.forEach(t => {
        const src = state.entities.find(e => e.id === t.sourceId);
        const tgt = state.entities.find(e => e.id === t.targetId);
        if (src && tgt) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', src.x);
            line.setAttribute('y1', src.y);
            line.setAttribute('x2', tgt.x);
            line.setAttribute('y2', tgt.y);
            line.setAttribute('class', 'tether-line');
            svgLayer.appendChild(line);
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
        const src = state.entities.find(e => e.id === t.sourceId);
        if (src && src.pods > 0.5) {
            const amount = Math.min(0.5, src.pods) * tetherBonus;
            src.pods -= amount;
            totalHarvested += amount;
            if (Math.random() > 0.5) {
                const tgt = state.entities.find(e => e.id === t.targetId);
                createSellParticle(src.x, src.y, tgt.x, tgt.y);
            }
        }
    });

    if (totalHarvested > 0) {
        const gained = totalHarvested * moteMultiplier * buffMulti * sparkMulti;
        state.motes += gained;
        state.stats.totalMotesEarned += gained;
        updateHUD();
    }
}
setInterval(tetherHarvest, 2000);

function updateHUD() {
    const currentPods = Math.floor(state.pods);
    podsDisplay.textContent = `${currentPods} / ${state.player.maxPods}`;
    motesDisplay.textContent = Math.floor(state.motes);

    if (currentPods >= state.player.maxPods) {
        podsDisplay.style.color = '#ff4444'; podsDisplay.style.textShadow = '0 0 10px #ff4444'; podsDisplay.classList.add('bag-full');
    } else {
        podsDisplay.style.color = 'var(--neon-cyan)'; podsDisplay.style.textShadow = '0 0 10px var(--neon-cyan)'; podsDisplay.classList.remove('bag-full');
    }

    if (state.stats.totalStarsHarvested > 0) {
        if (starsItem) starsItem.style.display = 'flex';
        starsCount.textContent = state.starFragments;
    }

    if (state.sparks > 0) {
        if (sparksItem) sparksItem.style.display = 'flex';
        sparksCount.textContent = state.sparks;
    }

    if (state.level >= 10 && ascendToggle) {
        ascendToggle.style.display = 'block';
    } else if (ascendToggle) {
        ascendToggle.style.display = 'none';
    }

    if (buildToggle && tetherCountDisplay) {
        const weaverLevel = state.upgrades.find(u => u.id === 'light_weaver').level;
        if (weaverLevel > 0) {
            buildToggle.style.display = 'flex';
            tetherCountDisplay.textContent = `${state.tethers.length}/${weaverLevel}`;

            if (state.tethers.length >= weaverLevel && !state.buildMode.active) {
                buildToggle.style.background = 'rgba(255, 0, 0, 0.4)';
                buildToggle.style.borderColor = 'rgba(255, 0, 0, 0.6)';
            } else {
                if (state.buildMode.active) {
                    buildToggle.style.background = 'rgba(255, 128, 0, 0.4)';
                } else {
                    buildToggle.style.background = 'rgba(0, 255, 128, 0.2)';
                    buildToggle.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }
            }
        } else {
            buildToggle.style.display = 'none';
        }
    }

    if (state.buffs.active) {
        buffDisplay.style.display = 'block';
        buffTimer.textContent = state.buffs.timer;
    } else {
        buffDisplay.style.display = 'none';
    }

    if (levelDisplay) levelDisplay.textContent = state.level;

    const objective = getLevelObjective(state.level);
    const progress = getObjectiveProgress(objective);

    if (objectiveDesc) {
        // Only update inner HTML if shape changes, for performance, but simple enough here
        objectiveDesc.innerHTML = `${objective.desc}: <span id="objective-progress" class="${progress >= objective.target ? 'neon-purple' : 'neon-lime'}">${Math.min(progress, objective.target)}</span> / <span id="objective-target">${objective.target}</span>`;
    }

    updateBurstUI();

    if (progress >= objective.target) {
        if (levelUpBtn) levelUpBtn.style.display = 'block';
    } else {
        if (levelUpBtn) levelUpBtn.style.display = 'none';
    }
}

function renderUpgrades() {
    upgradeList.innerHTML = '';
    state.upgrades.forEach(upgrade => {
        const cost = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMult, upgrade.level));
        const currencySym = upgrade.currency === 'starFragments' ? '🌟' : '✨';
        const canAfford = upgrade.currency === 'starFragments' ? state.starFragments >= cost : state.motes >= cost;
        const colorClass = upgrade.currency === 'starFragments' ? 'neon-gold' : 'neon-lime';

        if (upgrade.currency === 'starFragments' && state.stats.totalStarsHarvested === 0) return; // Hide until player finds a star

        const card = document.createElement('div');
        card.className = 'upgrade-card glass';
        card.innerHTML = `<div><h3>${upgrade.name} (Lv. ${upgrade.level})</h3><p>${upgrade.description}</p></div><button class="upgrade-btn" style="${upgrade.currency === 'starFragments' ? 'background: #b8860b;' : ''}" ${canAfford ? '' : 'disabled'} data-id="${upgrade.id}">${cost} ${currencySym}</button>`;
        upgradeList.appendChild(card);
    });
}

function buyUpgrade(id) {
    const upgrade = state.upgrades.find(u => u.id === id);
    const cost = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMult, upgrade.level));

    if (upgrade.currency === 'starFragments') {
        if (state.starFragments >= cost) {
            state.starFragments -= cost;
            upgrade.level++;
            state.stats.upgradesBoughtThisLevel++;
            updateHUD(); renderUpgrades(); saveGame();
        }
    } else {
        if (state.motes >= cost) {
            state.motes -= cost;
            upgrade.level++;
            state.stats.upgradesBoughtThisLevel++;

            // Re-calculate stats with permanent bonuses
            const speedBonus = 1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0);
            const capBonus = state.sparkUpgrades.celestial_pockets ? 50 : 0;

            if (upgrade.id === 'speed') state.player.speed = upgrade.effect(upgrade.level) * speedBonus;
            else if (upgrade.id === 'capacity') state.player.maxPods = upgrade.effect(upgrade.level) + capBonus;
            updateHUD(); renderUpgrades(); saveGame();
        }
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
    ascendPanel.classList.add('hidden');
    openAstralForge();
    saveGame();
}

function openAstralForge() {
    astralSparkCount.textContent = state.sparks;
    renderAstralTree();
    astralPanel.classList.remove('hidden');
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
    astralPanel.classList.add('hidden');
    initWorld();
    updateWorldColors();
    updateHUD();
    renderUpgrades();
    saveGame();

    // Play big success sound
    setTimeout(() => playTone(300, 'sine', 1.0, 0.6), 0);
    setTimeout(() => playTone(500, 'sine', 1.5, 0.8), 400);
}

let isWiping = false;

function saveGame() {
    if (isWiping) return; // Don't save if we are hard resetting

    const saveData = {
        level: state.level, world: state.world,
        pods: state.pods, motes: state.motes, starFragments: state.starFragments, sparks: state.sparks, player: { x: state.player.x, y: state.player.y, sprite: state.player.sprite },
        stats: state.stats, buffs: state.buffs, tethers: state.tethers,
        upgrades: state.upgrades.map(u => ({ id: u.id, level: u.level })),
        sparkUpgrades: state.sparkUpgrades,
        cosmetics: state.cosmetics.map(c => ({ id: c.id, unlocked: c.unlocked })),
        entities: state.entities
    };
    localStorage.setItem('lushHarvestSave', JSON.stringify(saveData));
}

function loadGame() {
    try {
        const saved = localStorage.getItem('lushHarvestSave');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.level === 'number') state.level = parsed.level;
            if (typeof parsed.motesToNextLevel === 'number') state.motesToNextLevel = parsed.motesToNextLevel;
            if (parsed.world) state.world = parsed.world;
            if (Array.isArray(parsed.entities)) state.entities = parsed.entities;
            state.pods = parsed.pods || 0;
            state.motes = parsed.motes || 0;
            state.starFragments = parsed.starFragments || 0;
            state.sparks = parsed.sparks || 0;
            state.tethers = parsed.tethers || [];
            if (parsed.buffs) state.buffs = parsed.buffs;
            if (parsed.stats) {
                state.stats.totalPodsHarvested = typeof parsed.stats.totalPodsHarvested === 'number' ? parsed.stats.totalPodsHarvested : 0;
                state.stats.totalStarsHarvested = typeof parsed.stats.totalStarsHarvested === 'number' ? parsed.stats.totalStarsHarvested : 0;
                state.stats.totalMotesEarned = typeof parsed.stats.totalMotesEarned === 'number' ? parsed.stats.totalMotesEarned : 0;
                state.stats.upgradesBoughtThisLevel = typeof parsed.stats.upgradesBoughtThisLevel === 'number' ? parsed.stats.upgradesBoughtThisLevel : 0;
            }

            if (parsed.player && typeof parsed.player.x === 'number') {
                state.player.x = parsed.player.x; state.player.y = parsed.player.y;
                if (parsed.player.sprite) state.player.sprite = parsed.player.sprite;
            }

            if (parsed.upgrades) {
                parsed.upgrades.forEach(savedUpgrade => {
                    const u = state.upgrades.find(upg => upg.id === savedUpgrade.id);
                    if (u) u.level = savedUpgrade.level;
                });
            }

            if (parsed.cosmetics) {
                parsed.cosmetics.forEach(savedCos => {
                    const c = state.cosmetics.find(cos => cos.id === savedCos.id);
                    if (c) c.unlocked = savedCos.unlocked;
                });
            }

            if (parsed.sparkUpgrades) state.sparkUpgrades = parsed.sparkUpgrades;
            // Removed permanent astralToggle visibility check as requested

            // Apply permanent bonuses to base stats
            const speedBonus = 1 + (state.sparkUpgrades.luminous_stride ? 0.15 : 0);
            const capBonus = state.sparkUpgrades.celestial_pockets ? 50 : 0;

            state.player.speed = state.upgrades.find(u => u.id === 'speed').effect(state.upgrades.find(u => u.id === 'speed').level) * speedBonus;
            state.player.maxPods = state.upgrades.find(u => u.id === 'capacity').effect(state.upgrades.find(u => u.id === 'capacity').level) + capBonus;
        }
    } catch (error) {
        console.error("Save file corrupted. Wiping save.", error);
        localStorage.removeItem('lushHarvestSave');
    }
    updateWorldColors();
    renderTethers();
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

upgradesToggle.addEventListener('click', () => { renderUpgrades(); upgradesPanel.classList.remove('hidden'); });
closeUpgrades.addEventListener('click', () => upgradesPanel.classList.add('hidden'));
upgradeList.addEventListener('click', (e) => { if (e.target.classList.contains('upgrade-btn')) buyUpgrade(e.target.dataset.id); });

// astralToggle removed as requested
closeAstral.addEventListener('click', () => astralPanel.classList.add('hidden'));
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
                    buildToggle.textContent = "Already tethered!";
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
                state.tethers.push({ sourceId: state.buildMode.sourceId, targetId: forge.id });
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

cosmeticsToggle.addEventListener('click', () => { renderCosmetics(); cosmeticsPanel.classList.remove('hidden'); });
closeCosmetics.addEventListener('click', () => cosmeticsPanel.classList.add('hidden'));
cosmeticList.addEventListener('click', (e) => { if (e.target.classList.contains('cosmetic-btn')) handleCosmeticClick(e.target.dataset.id); });

settingsToggle.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
closeSettings.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    settingsMsg.textContent = '';
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
            overlay.classList.add('hidden');
            settingsMsg.textContent = '';
        }
    });
});

ascendToggle.addEventListener('click', () => {
    ascendReward.textContent = calculateSparksReward();
    ascendPanel.classList.remove('hidden');
});
closeAscend.addEventListener('click', () => ascendPanel.classList.add('hidden'));
confirmAscend.addEventListener('click', handleAscend);

setInterval(() => {
    if (state.buffs.active) {
        state.buffs.timer--;
        if (state.buffs.timer <= 0) {
            state.buffs.active = false;
            state.buffs.timer = 0;
        }
        updateHUD();
    }
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
    el.className = 'void-spirit';
    el.id = id;
    el.innerHTML = '<div class="spirit-core"></div>';
    entitiesLayer.appendChild(el);

    const thresholds = Object.keys(biomes).map(Number).sort((a, b) => b - a);
    const activeThreshold = thresholds.find(t => state.level >= t) || 1;
    const biome = biomes[activeThreshold];

    state.voidSpirits.push({ id, x, y, el, dispelling: false, speed: (1 + Math.random() * 1.5) * biome.spiritSpeed });
}

function updateSpirits() {
    state.voidSpirits = state.voidSpirits.filter(s => {
        if (s.dispelling) {
            s.el.style.opacity = parseFloat(s.el.style.opacity || 1) - 0.1;
            if (parseFloat(s.el.style.opacity) <= 0) {
                s.el.remove();
                return false;
            }
            return true;
        }

        // Move toward player OR nearest tether
        let target = { x: state.player.x, y: state.player.y };
        let minDist = Math.sqrt(Math.pow(s.x - target.x, 2) + Math.pow(s.y - target.y, 2));

        state.tethers.forEach(t => {
            const src = state.entities.find(e => e.id === t.sourceId);
            if (src) {
                const d = Math.sqrt(Math.pow(s.x - src.x, 2) + Math.pow(s.y - src.y, 2));
                if (d < minDist) { minDist = d; target = { x: src.x, y: src.y }; }
            }
        });

        const dx = target.x - s.x;
        const dy = target.y - s.y;
        const angle = Math.atan2(dy, dx);
        s.x += Math.cos(angle) * s.speed;
        s.y += Math.sin(angle) * s.speed;

        s.el.style.left = `${s.x - 20}px`;
        s.el.style.top = `${s.y - 20}px`;

        // Collision with player
        if (minDist < 30 && target.x === state.player.x) {
            // Void Shield bonus: Chance to ignore hit (or just reduce penalty)
            const damage = state.sparkUpgrades.void_shield ? 2 : 5;
            state.pods = Math.max(0, state.pods - damage);
            s.dispelling = true;
            playTone(150, 'sawtooth', 0.3, 0.4, true);
            updateHUD();
        }

        // Collision with tree/tether
        if (minDist < 40 && target.x !== state.player.x) {
            // "Dim" the tree for a moment (visual only for now, could disable tether)
            s.dispelling = true;
            playTone(200, 'sine', 0.4, 0.2);
        }

        return true;
    });
}

// Initial spirit spawning setup is handled by updateBiome() during init calls
if (state.spiritIntervalId === null) {
    updateBiome();
}

if (burstBtn) burstBtn.addEventListener('click', () => { triggerBurst(); });
window.addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest('.hud, .actions, .overlay')) triggerBurst(); });

function updateBurstUI() {
    if (!burstFill) return;
    const pct = (state.burst.cooldown / state.burst.maxCooldown) * 100;
    burstFill.style.transform = `translateY(${pct}%)`;
}

loadGame(); initWorld(); updateHUD(); update();

// Debug / Cheat Access
window.state = state;
window.updateHUD = updateHUD;