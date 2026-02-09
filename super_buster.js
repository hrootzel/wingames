import { SfxEngine } from './sfx_engine.js';
import { BANK_SUPERBUSTER } from './sfx_bank_super_buster.js';
import { drawBackground, drawHarpoon, drawBall, drawPlayer } from './super_buster_sprite.js';
import { initGameShell } from './game-shell.js';
import {
  clamp,
  normalizeLevelPack,
  makeBall,
  advanceHarpoon,
  updateBall,
  clampBallVelocity,
  collideBallWithSolid,
  harpoonHitsBall,
  updatePlayerMovement,
} from './super_buster_engine.mjs';

const WORLD_W = 640;
const WORLD_H = 360;
const FLOOR_Y = WORLD_H - 24;

const BASE_GRAVITY = 320;
const RADIUS = [10, 16, 24, 34];
const BASE_JUMP_SPEED = [240, 320, 420, 520];
const BASE_VX_MAG = [118, 108, 98, 90];
const SCORE_RULES = {
  ballPop: 100,
  itemPickup: 500,
  fruitPickup: 1000,
  timeBonusPerSec: 20,
  perfectBonus: 1000,
};
const STARTING_LIVES = 3;
const MOVE_SFX_INTERVAL = 0.09;
const BALL_CAP_FACTOR = 1.08;
const POWERUP_FALL_GRAVITY = 420;
const POWERUP_LIFETIME = 9;
const BULLET_SPEED = 560;
const BULLET_COOLDOWN = 0.085;
const SOLID_CRUMBLE_DURATION = 0.24;
const POWERUP_DURATION = {
  sticky: 16,
  double: 14,
  gun: 10,
  slow: 10,
  freeze: 4.5,
};
const WEAPON_TYPES = {
  single: 'single',
  sticky: 'sticky',
  double: 'double',
  gun: 'gun',
};
const POWERUP_TYPES = ['shield', 'sticky', 'double', 'gun', 'slow', 'freeze', 'dynamite', 'life', 'single', 'fruit'];
const MODE_TYPES = ['campaign', 'endless'];
const POWERUP_ALIAS = {
  'two ropes': 'double',
  tworopes: 'double',
  double: 'double',
  'metal rope': 'sticky',
  metalrope: 'sticky',
  sticky: 'sticky',
  gun: 'gun',
  hourglass: 'slow',
  slow: 'slow',
  clock: 'freeze',
  freeze: 'freeze',
  'blue goo': 'shield',
  shield: 'shield',
  dynamite: 'dynamite',
  '1-up': 'life',
  '1up': 'life',
  life: 'life',
  fruit: 'fruit',
  single: 'single',
  none: null,
};

const STORAGE = {
  settings: 'super_buster:v1:settings',
};

const DEFAULT_SETTINGS = {
  mode: 'campaign',
  difficulty: 'normal',
  showGeometry: true,
  volume: 0.6,
};

const DIFFICULTY_PRESETS = {
  easy: { name: 'Easy', speedMul: 0.88, gravityMul: 0.9, timeMul: 1.12, bonusDropChance: 0.2 },
  normal: { name: 'Normal', speedMul: 1.0, gravityMul: 1.0, timeMul: 1.0, bonusDropChance: 0.1 },
  hard: { name: 'Hard', speedMul: 1.14, gravityMul: 1.07, timeMul: 0.9, bonusDropChance: 0.05 },
  nightmare: { name: 'Nightmare', speedMul: 1.28, gravityMul: 1.15, timeMul: 0.82, bonusDropChance: 0.02 },
};

const GameState = {
  LEVEL_START: 'LEVEL_START',
  PLAYING: 'PLAYING',
  PLAYER_HIT: 'PLAYER_HIT',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
};

const DEFAULT_LEVELS = [
  {
    id: 'L1',
    name: 'Level 1',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [
      { size: 3, x: 160, y: 120, dir: 1 },
    ],
  },
  {
    id: 'L2',
    name: 'Level 2',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [
      { size: 3, x: 140, y: 140, dir: 1 },
      { size: 2, x: 420, y: 110, dir: -1 },
    ],
  },
  {
    id: 'L3',
    name: 'Level 3',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [
      { size: 3, x: 200, y: 90, dir: 1 },
      { size: 3, x: 440, y: 90, dir: -1 },
    ],
  },
  {
    id: 'L4',
    name: 'Level 4',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [
      { size: 2, x: 140, y: 80, dir: 1 },
      { size: 2, x: 320, y: 120, dir: -1 },
      { size: 2, x: 500, y: 80, dir: 1 },
    ],
  },
];
let LEVELS = DEFAULT_LEVELS;

const BALL_COLORS = [
  { base: '#7dd3fc', highlight: '#e0f2fe', shadow: '#0284c7' },
  { base: '#fda4af', highlight: '#ffe4e6', shadow: '#e11d48' },
  { base: '#a7f3d0', highlight: '#ecfdf5', shadow: '#059669' },
  { base: '#fde68a', highlight: '#fef3c7', shadow: '#d97706' },
];

const FIXED_DT = 1 / 120;

const canvas = document.getElementById('buster-canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time');
const newBtn = document.getElementById('new-game');
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const optDifficulty = document.getElementById('opt-difficulty');
const optMode = document.getElementById('opt-mode');
const optGeometry = document.getElementById('opt-geometry');
const optVolume = document.getElementById('opt-volume');

const sfx = new SfxEngine({ master: DEFAULT_SETTINGS.volume });
let audioUnlocked = false;

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  fireHeld: false,
  firePressed: false,
};

const game = {
  player: {
    x: WORLD_W * 0.5,
    y: FLOOR_Y,
    w: 22,
    h: 28,
    speed: 220,
    climbSpeed: 170,
    hitR: 12,
    onLadder: false,
    ladderIndex: -1,
    gapBridgeRemaining: 0,
    gapBridgeY: FLOOR_Y,
    vy: 0,
    facing: 1,
    shootTimer: 0,
    weaponType: WEAPON_TYPES.single,
    weaponTimer: 0,
    shieldCharges: 0,
    bulletCooldown: 0,
  },
  harpoons: [],
  bullets: [],
  powerups: [],
  balls: [],
  geometry: { solids: [], ladders: [] },
  levelIndex: 0,
  levelTimeLeft: 0,
  score: 0,
  lives: STARTING_LIVES,
  moveSfxTimer: MOVE_SFX_INTERVAL,
  state: GameState.LEVEL_START,
  stateTimer: 0,
  status: 'Ready.',
  tuning: null,
  levelStartLives: STARTING_LIVES,
  slowTimer: 0,
  freezeTimer: 0,
  endlessSpawnTimer: 0,
  dropRngState: 0,
  levelPopCounter: 0,
  levelSolidBreakCounter: 0,
};

function hash32(input) {
  let h = 2166136261 >>> 0;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initLevelDropRng(level) {
  const levelId = level?.id || `L${game.levelIndex + 1}`;
  game.dropRngState = (hash32(`drop:${settings.mode}:${levelId}:${game.levelIndex}`) ^ 0x9e3779b9) >>> 0;
  if (game.dropRngState === 0) game.dropRngState = 0x6d2b79f5;
  game.levelPopCounter = 0;
  game.levelSolidBreakCounter = 0;
}

function nextDropRand() {
  let x = game.dropRngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  game.dropRngState = x >>> 0;
  return (game.dropRngState >>> 0) / 4294967296;
}

function normalizePowerupName(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(POWERUP_ALIAS, key)) {
    return POWERUP_ALIAS[key];
  }
  return POWERUP_TYPES.includes(key) ? key : null;
}

function cloneGeometryForRuntime(geometry) {
  const solids = (geometry?.solids || []).map((rect) => ({
    ...rect,
    _hp: rect.destructible ? Math.max(1, Math.round(Number(rect.hitPoints) || 1)) : 0,
    _crumble: 0,
    _destroyed: false,
  }));
  const ladders = (geometry?.ladders || []).map((ladder) => ({ ...ladder }));
  return { solids, ladders };
}

function activeSolids(solids) {
  return (solids || []).filter((solid) => solid && !solid._destroyed && !solid.disabled);
}

function damageSolidFromHarpoon(solidIndex) {
  if (!Number.isFinite(solidIndex) || solidIndex < 0) return false;
  const solid = game.geometry?.solids?.[solidIndex];
  if (!solid || solid._destroyed || !solid.destructible) return false;
  solid._hp = Math.max(0, (Number.isFinite(solid._hp) ? solid._hp : Math.max(1, solid.hitPoints || 1)) - 1);
  if (solid._hp <= 0) {
    solid._destroyed = true;
    solid._crumble = SOLID_CRUMBLE_DURATION;
    maybeSpawnSolidDrop(solid);
    game.status = `${solid.kind === 'barrier' ? 'Barrier' : 'Platform'} destroyed`;
    sfx.play(BANK_SUPERBUSTER, 'pop');
  }
  return true;
}

function updateCrumblingSolids(dt) {
  const solids = game.geometry?.solids || [];
  for (let i = solids.length - 1; i >= 0; i -= 1) {
    const solid = solids[i];
    if (!solid || !solid._destroyed) continue;
    solid._crumble = Math.max(0, (Number(solid._crumble) || 0) - dt);
    if (solid._crumble <= 0) {
      solids.splice(i, 1);
    }
  }
}

let settings = loadSettings();

function scaleArray(values, mul) {
  return values.map((v) => v * mul);
}

function getPreset(diff) {
  return DIFFICULTY_PRESETS[diff] || DIFFICULTY_PRESETS.normal;
}

function buildTuning(currentSettings) {
  const preset = getPreset(currentSettings.difficulty);
  return {
    preset,
    gravity: BASE_GRAVITY * preset.gravityMul,
    jumpSpeed: scaleArray(BASE_JUMP_SPEED, preset.speedMul),
    vxMag: scaleArray(BASE_VX_MAG, preset.speedMul),
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const mode = MODE_TYPES.includes(parsed.mode) ? parsed.mode : DEFAULT_SETTINGS.mode;
    const difficulty = Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, parsed.difficulty)
      ? parsed.difficulty
      : DEFAULT_SETTINGS.difficulty;
    const showGeometry = parsed.showGeometry !== false;
    const volumeNum = Number(parsed.volume);
    const volume = Number.isFinite(volumeNum) ? clamp(volumeNum, 0, 1) : DEFAULT_SETTINGS.volume;
    return { mode, difficulty, showGeometry, volume };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(next));
  } catch (err) {
    // ignore
  }
}

function applySettingsToRuntime(previousSettings = null) {
  const prevTuning = game.tuning;
  game.tuning = buildTuning(settings);
  sfx.setMaster(settings.volume);

  if (previousSettings && prevTuning) {
    const oldMul = prevTuning.preset.speedMul;
    const newMul = game.tuning.preset.speedMul;
    if (oldMul > 0 && newMul > 0 && Math.abs(oldMul - newMul) > 1e-6) {
      const scale = newMul / oldMul;
      for (const ball of game.balls) {
        ball.vx *= scale;
        ball.vy *= scale;
        clampBallVelocity(ball, {
          jumpSpeed: game.tuning.jumpSpeed,
          vxMag: game.tuning.vxMag,
          capFactor: BALL_CAP_FACTOR,
        });
      }
    }
  }
}

function openSettings() {
  if (!settingsModal) return;
  optMode.value = settings.mode;
  optDifficulty.value = settings.difficulty;
  optGeometry.checked = settings.showGeometry;
  optVolume.value = String(settings.volume);
  settingsModal.classList.remove('hidden');
  settingsToggle?.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  if (!settingsModal) return;
  settingsModal.classList.add('hidden');
  settingsToggle?.setAttribute('aria-expanded', 'false');
}

function applySettingsFromModal() {
  const prev = { ...settings };
  settings = {
    mode: MODE_TYPES.includes(optMode.value) ? optMode.value : DEFAULT_SETTINGS.mode,
    difficulty: Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, optDifficulty.value)
      ? optDifficulty.value
      : DEFAULT_SETTINGS.difficulty,
    showGeometry: !!optGeometry.checked,
    volume: clamp(Number(optVolume.value), 0, 1),
  };
  saveSettings(settings);
  applySettingsToRuntime(prev);
  const modeChanged = prev.mode !== settings.mode;
  game.status = `Settings applied (${settings.mode}, ${getPreset(settings.difficulty).name}).`;
  if (modeChanged) {
    newGame();
  }
  closeSettings();
}

function isEndlessMode() {
  return settings.mode === 'endless';
}

function randomEndlessType(wave) {
  const r = Math.random();
  if (wave >= 8 && r < 0.18) return 'seeker';
  if (wave >= 5 && r < 0.34) return 'bouncy';
  if (wave >= 3 && r < 0.48) return 'hexa';
  return 'normal';
}

function randomEndlessSize(wave) {
  if (wave < 2) return 3;
  if (wave < 5) return Math.random() < 0.6 ? 3 : 2;
  if (wave < 10) return Math.random() < 0.5 ? 2 : 1;
  const r = Math.random();
  if (r < 0.25) return 3;
  if (r < 0.65) return 2;
  return 1;
}

function buildEndlessSpecs(wave, count) {
  const specs = [];
  for (let i = 0; i < count; i += 1) {
    specs.push({
      type: randomEndlessType(wave),
      size: randomEndlessSize(wave),
      x: 44 + Math.random() * (WORLD_W - 88),
      y: 62 + Math.random() * 76,
      dir: Math.random() < 0.5 ? -1 : 1,
    });
  }
  return specs;
}

function pickEndlessGeometry(wave) {
  const source = LEVELS[wave % LEVELS.length] || LEVELS[0];
  return source?.geometry || { solids: [], ladders: [] };
}

function spawnEndlessWave() {
  const wave = game.levelIndex + 1;
  const tuning = game.tuning || buildTuning(settings);
  const waveCount = 1 + Math.min(6, Math.floor((wave + 1) / 2));
  const specs = buildEndlessSpecs(wave, waveCount);
  for (const spec of specs) {
    game.balls.push(makeBall(spec, {
      radius: RADIUS,
      vxMag: tuning.vxMag,
      jumpSpeed: tuning.jumpSpeed,
      worldW: WORLD_W,
      floorY: FLOOR_Y,
    }));
  }
  game.endlessSpawnTimer = Math.max(1.6, 4.4 - wave * 0.12);
  game.status = `Endless wave ${wave}`;
}

async function tryLoadExternalLevelPack() {
  try {
    const response = await fetch('./levels/levelpack_v1.json', { cache: 'no-store' });
    if (!response.ok) {
      return false;
    }
    const pack = await response.json();
    LEVELS = normalizeLevelPack(pack, { maxSize: RADIUS.length - 1, timeDefault: 60 });
    return true;
  } catch (err) {
    console.warn('Failed to load external level pack, using defaults.', err);
    return false;
  }
}

function loadLevel() {
  const endless = isEndlessMode();
  const level = LEVELS[game.levelIndex] || LEVELS[game.levelIndex % LEVELS.length] || LEVELS[0];
  const tuning = game.tuning || buildTuning(settings);
  const timeMul = tuning.preset.timeMul || 1;
  initLevelDropRng(level);
  if (endless) {
    game.balls = [];
    game.geometry = cloneGeometryForRuntime(pickEndlessGeometry(game.levelIndex));
    game.levelTimeLeft = Number.POSITIVE_INFINITY;
  } else {
    game.balls = level.balls.map((spec) => makeBall(spec, {
      radius: RADIUS,
      vxMag: tuning.vxMag,
      jumpSpeed: tuning.jumpSpeed,
      worldW: WORLD_W,
      floorY: FLOOR_Y,
    }));
    game.geometry = cloneGeometryForRuntime(level.geometry || { solids: [], ladders: [] });
    game.levelTimeLeft = Math.max(1, (Number(level.timeLimitSec) || 60) * timeMul);
  }
  game.harpoons = [];
  game.bullets = [];
  game.powerups = [];
  game.player.x = WORLD_W * 0.5;
  game.player.y = FLOOR_Y;
  game.player.onLadder = false;
  game.player.ladderIndex = -1;
  game.player.vy = 0;
  game.player.gapBridgeRemaining = 0;
  game.player.gapBridgeY = FLOOR_Y;
  game.player.facing = 1;
  game.player.shootTimer = 0;
  game.player.weaponType = WEAPON_TYPES.single;
  game.player.weaponTimer = 0;
  game.player.shieldCharges = 0;
  game.player.bulletCooldown = 0;
  game.state = GameState.PLAYING;
  game.stateTimer = 0;
  game.levelStartLives = game.lives;
  game.slowTimer = 0;
  game.freezeTimer = 0;
  game.endlessSpawnTimer = 0;
  if (endless) {
    spawnEndlessWave();
  } else {
    game.status = level.name;
  }
}

function newGame() {
  game.levelIndex = 0;
  game.score = 0;
  game.lives = STARTING_LIVES;
  game.balls = [];
  game.geometry = { solids: [], ladders: [] };
  game.levelTimeLeft = 0;
  game.harpoons = [];
  game.bullets = [];
  game.powerups = [];
  game.player.y = FLOOR_Y;
  game.player.onLadder = false;
  game.player.ladderIndex = -1;
  game.player.vy = 0;
  game.player.gapBridgeRemaining = 0;
  game.player.gapBridgeY = FLOOR_Y;
  game.player.facing = 1;
  game.player.shootTimer = 0;
  game.player.weaponType = WEAPON_TYPES.single;
  game.player.weaponTimer = 0;
  game.player.shieldCharges = 0;
  game.player.bulletCooldown = 0;
  game.moveSfxTimer = MOVE_SFX_INTERVAL;
  game.state = GameState.LEVEL_START;
  game.stateTimer = 0;
  game.levelStartLives = STARTING_LIVES;
  game.slowTimer = 0;
  game.freezeTimer = 0;
  game.endlessSpawnTimer = 0;
  game.status = 'Ready.';
}

function makeHarpoon(x, yBottom) {
  const bottom = clamp(Number(yBottom), 0, FLOOR_Y);
  return {
    active: true,
    x,
    yBottom: bottom,
    yTop: bottom,
    extendSpeed: 900,
    stickTime: game.player.weaponType === WEAPON_TYPES.sticky ? 2.2 : 0.25,
    state: 'extend',
    timer: 0,
  };
}

function fireHarpoon() {
  if (game.player.weaponType === WEAPON_TYPES.double && game.harpoons.length >= 2) return;
  if (game.player.weaponType !== WEAPON_TYPES.double && game.harpoons.length >= 1) return;
  // Match Pang behavior: rope starts from the hunter's current foot level.
  game.harpoons.push(makeHarpoon(game.player.x, game.player.y));
  game.player.shootTimer = 0.13;
  sfx.play(BANK_SUPERBUSTER, 'shoot');
}

function fireGun() {
  if (game.player.bulletCooldown > 0) return;
  const y = game.player.y - game.player.h + 2;
  game.bullets.push({ x: game.player.x - 3.5, y, vy: -BULLET_SPEED, r: 2.6 });
  game.bullets.push({ x: game.player.x + 3.5, y, vy: -BULLET_SPEED, r: 2.6 });
  game.player.bulletCooldown = BULLET_COOLDOWN;
  game.player.shootTimer = 0.1;
  sfx.play(BANK_SUPERBUSTER, 'shoot');
}

function updateHarpoons(dt) {
  for (let i = game.harpoons.length - 1; i >= 0; i -= 1) {
    const h = game.harpoons[i];
    const result = advanceHarpoon(h, dt, game.geometry.solids, 0);
    if (result.stuck) {
      sfx.play(BANK_SUPERBUSTER, 'harpoonTop');
      if (result.stuckAt === 'solid') {
        damageSolidFromHarpoon(result.solidIndex);
      }
    }
    if (!h.active) {
      game.harpoons.splice(i, 1);
    }
  }
}

function shouldDropPowerup(ballSize) {
  if (ballSize <= 0) return false;
  const tuning = game.tuning || buildTuning(settings);
  const chance = tuning.preset.bonusDropChance || 0;
  const roll = isEndlessMode() ? Math.random() : nextDropRand();
  return roll < chance;
}

function randomPowerupType() {
  const r = isEndlessMode() ? Math.random() : nextDropRand();
  if (r < 0.17) return 'shield';
  if (r < 0.30) return 'sticky';
  if (r < 0.43) return 'double';
  if (r < 0.54) return 'gun';
  if (r < 0.65) return 'slow';
  if (r < 0.73) return 'freeze';
  if (r < 0.81) return 'dynamite';
  if (r < 0.87) return 'single';
  if (r < 0.93) return 'life';
  return 'fruit';
}

function maybeSpawnPowerupFromBall(ball) {
  game.levelPopCounter += 1;
  if (!shouldDropPowerup(ball.size)) return;
  const type = randomPowerupType();
  spawnPowerup(type, ball.x, Math.max(12, ball.y - 8));
}

function spawnPowerup(type, x, y) {
  const normalized = normalizePowerupName(type);
  if (!normalized) return false;
  game.powerups.push({
    type: normalized,
    x: clamp(Number(x), 8, WORLD_W - 8),
    y: clamp(Number(y), 8, FLOOR_Y - 8),
    vy: -120,
    ttl: POWERUP_LIFETIME,
    r: 9,
  });
  return true;
}

function maybeSpawnSolidDrop(solid) {
  if (!solid) return false;
  const explicit = normalizePowerupName(solid.drop);
  if (explicit) {
    game.levelSolidBreakCounter += 1;
    return spawnPowerup(explicit, solid.x + solid.w * 0.5, solid.y - 8);
  }
  if (Array.isArray(solid.dropTable) && solid.dropTable.length > 0) {
    const i = game.levelSolidBreakCounter % solid.dropTable.length;
    game.levelSolidBreakCounter += 1;
    const chosen = normalizePowerupName(solid.dropTable[i]);
    if (!chosen) return false;
    return spawnPowerup(chosen, solid.x + solid.w * 0.5, solid.y - 8);
  }
  return false;
}

function applyPowerup(type) {
  if (type === 'fruit') {
    game.score += SCORE_RULES.fruitPickup;
    game.status = 'Fruit bonus!';
    return;
  }
  game.score += SCORE_RULES.itemPickup;
  if (type === 'shield') {
    game.player.shieldCharges = 1;
    game.status = 'Bubble shield acquired.';
    return;
  }
  if (type === 'single') {
    game.player.weaponType = WEAPON_TYPES.single;
    game.player.weaponTimer = 0;
    game.status = 'Weapon reset to harpoon.';
    return;
  }
  if (type === 'life') {
    game.lives = Math.min(9, game.lives + 1);
    game.status = '1UP!';
    return;
  }
  if (type === 'slow') {
    game.slowTimer = POWERUP_DURATION.slow;
    game.freezeTimer = Math.max(0, game.freezeTimer - 0.8);
    game.status = 'Sandclock: enemy speed reduced.';
    return;
  }
  if (type === 'freeze') {
    game.freezeTimer = POWERUP_DURATION.freeze;
    game.slowTimer = Math.max(game.slowTimer, 1.2);
    game.status = 'Time freeze!';
    return;
  }
  if (type === 'dynamite') {
    triggerDynamite();
    game.status = 'Dynamite blast!';
    return;
  }
  if (type === 'sticky' || type === 'double' || type === 'gun') {
    game.player.weaponType = type;
    game.player.weaponTimer = POWERUP_DURATION[type];
    game.status = `${type} weapon online.`;
  }
}

function triggerDynamite() {
  for (let i = game.balls.length - 1; i >= 0; i -= 1) {
    if (game.balls[i].size > 0) {
      splitBall(i);
    }
  }
}

function updatePowerups(dt) {
  for (let i = game.powerups.length - 1; i >= 0; i -= 1) {
    const p = game.powerups[i];
    p.ttl -= dt;
    const oldY = p.y;
    p.vy += POWERUP_FALL_GRAVITY * dt;
    const nextY = p.y + p.vy * dt;

    let supportY = FLOOR_Y - p.r;
    const solids = activeSolids(game.geometry?.solids || []);
    for (const rect of solids) {
      if (rect.kind === 'barrier') continue;
      const left = rect.x + p.r - 1;
      const right = rect.x + rect.w - p.r + 1;
      if (p.x < left || p.x > right) continue;
      const top = rect.y - p.r;
      if (top >= oldY - 0.5 && top < supportY) {
        supportY = top;
      }
    }
    if (nextY >= supportY) {
      p.y = supportY;
      p.vy = 0;
    } else {
      p.y = nextY;
    }

    const dx = p.x - game.player.x;
    const dy = p.y - (game.player.y - game.player.h * 0.55);
    const rr = p.r + game.player.hitR * 0.8;
    if (dx * dx + dy * dy <= rr * rr) {
      applyPowerup(p.type);
      game.powerups.splice(i, 1);
      continue;
    }
    if (p.ttl <= 0) {
      game.powerups.splice(i, 1);
    }
  }
}

function updateBullets(dt) {
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.y += b.vy * dt;
    if (b.y < -8) {
      game.bullets.splice(i, 1);
    }
  }
}

function splitBall(index) {
  const ball = game.balls[index];
  const tuning = game.tuning || buildTuning(settings);
  const size = ball.size;
  game.balls.splice(index, 1);
  maybeSpawnPowerupFromBall(ball);
  game.score += getBallScore(ball.type, size);
  const maxSize = RADIUS.length - 1;
  sfx.play(BANK_SUPERBUSTER, 'hit', { sizeIndex: size, maxSize });
  if (size === 0) {
    sfx.play(BANK_SUPERBUSTER, 'pop');
    return;
  }

  const child = size - 1;
  const r = RADIUS[child];
  const baseY = Math.min(ball.y, FLOOR_Y - r);
  const isHexa = ball.type === 'hexa';
  const baseVx = tuning.vxMag[child];
  const vx = isHexa ? baseVx * 1.18 : baseVx;
  const vy = isHexa ? -(Math.abs(vx) * 0.34 + 28) : -tuning.jumpSpeed[child] * 0.85;
  sfx.play(BANK_SUPERBUSTER, 'split', { sizeIndex: size, childSizeIndex: child, maxSize });
  game.balls.push({
    type: ball.type || 'normal',
    size: child,
    x: ball.x - r * 0.25,
    y: baseY,
    vx: -vx,
    vy,
    spin: isHexa ? (ball.spin || 0) : undefined,
    spinRate: isHexa ? (-1) * (1.8 + child * 0.2) : undefined,
  });
  game.balls.push({
    type: ball.type || 'normal',
    size: child,
    x: ball.x + r * 0.25,
    y: baseY,
    vx,
    vy,
    spin: isHexa ? (ball.spin || 0) : undefined,
    spinRate: isHexa ? (1.8 + child * 0.2) : undefined,
  });
}

function getBallScore(type, size) {
  let score = SCORE_RULES.ballPop;
  if (type === 'hexa') score += 100;
  if (type === 'bouncy') score += 50;
  if (type === 'seeker') score += 100;
  if (size >= 2) score += 50;
  return score;
}

function playerHitBall(ball) {
  const px = game.player.x;
  const py = game.player.y - game.player.h * 0.55;
  const pr = game.player.hitR;
  const dx = ball.x - px;
  const dy = ball.y - py;
  const rr = RADIUS[ball.size] + pr;
  return dx * dx + dy * dy <= rr * rr;
}

function setPlayerHit() {
  game.state = GameState.PLAYER_HIT;
  game.stateTimer = 0.6;
  const lifeWord = game.lives === 1 ? 'life' : 'lives';
  game.status = `Hit! ${game.lives} ${lifeWord} left.`;
  game.harpoons = [];
  game.bullets = [];
}

function setLevelClear() {
  const timeBonus = Math.max(0, Math.floor(game.levelTimeLeft)) * SCORE_RULES.timeBonusPerSec;
  const perfectBonus = game.lives === game.levelStartLives ? SCORE_RULES.perfectBonus : 0;
  game.score += timeBonus + perfectBonus;
  game.state = GameState.LEVEL_CLEAR;
  game.stateTimer = 0.8;
  game.status = `Level clear! +${timeBonus}${perfectBonus ? ` +${perfectBonus} perfect` : ''}`;
  game.harpoons = [];
  game.bullets = [];
  sfx.play(BANK_SUPERBUSTER, 'levelClear', { level: game.levelIndex + 1 });
}

function setGameOver(message, playSfx = true) {
  game.state = GameState.GAME_OVER;
  game.status = message || 'Game over. Press R to restart.';
  game.harpoons = [];
  game.bullets = [];
  if (playSfx) {
    sfx.play(BANK_SUPERBUSTER, 'gameOver');
  }
}

function handlePlayerHit() {
  if (game.player.shieldCharges > 0) {
    game.player.shieldCharges -= 1;
    game.status = 'Shield absorbed the hit.';
    sfx.play(BANK_SUPERBUSTER, 'pop');
    return;
  }
  game.lives = Math.max(0, game.lives - 1);
  sfx.play(BANK_SUPERBUSTER, 'playerHit');
  if (game.lives <= 0) {
    setGameOver('Game over. Press R to restart.');
  } else {
    setPlayerHit();
  }
}

function updatePlaying(dt) {
  const tuning = game.tuning || buildTuning(settings);
  game.slowTimer = Math.max(0, game.slowTimer - dt);
  game.freezeTimer = Math.max(0, game.freezeTimer - dt);
  const ballTimeScale = game.freezeTimer > 0 ? 0 : (game.slowTimer > 0 ? 0.55 : 1);
  const ballDt = dt * ballTimeScale;
  game.player.shootTimer = Math.max(0, game.player.shootTimer - dt);
  game.player.bulletCooldown = Math.max(0, game.player.bulletCooldown - dt);
  if (game.player.weaponType !== WEAPON_TYPES.single) {
    game.player.weaponTimer = Math.max(0, game.player.weaponTimer - dt);
    if (game.player.weaponTimer <= 0) {
      game.player.weaponType = WEAPON_TYPES.single;
      game.status = 'Weapon reverted to harpoon.';
    }
  }
  game.levelTimeLeft = Math.max(0, game.levelTimeLeft - dt);
  if (!isEndlessMode() && game.levelTimeLeft <= 0) {
    game.status = 'Time up!';
    handlePlayerHit();
    return;
  }

  updateCrumblingSolids(dt);
  const solids = activeSolids(game.geometry.solids);
  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moveState = updatePlayerMovement(game.player, input, dt, {
    floorY: FLOOR_Y,
    worldW: WORLD_W,
    moveSpeed: game.player.speed,
    climbSpeed: game.player.climbSpeed,
    gravity: tuning.gravity,
    ladders: game.geometry.ladders,
    solids,
  });
  if (horizontal !== 0) {
    game.player.facing = horizontal > 0 ? 1 : -1;
  }
  if (moveState.movedHorizontally) {
    game.moveSfxTimer += dt;
    while (game.moveSfxTimer >= MOVE_SFX_INTERVAL) {
      sfx.play(BANK_SUPERBUSTER, 'move');
      game.moveSfxTimer -= MOVE_SFX_INTERVAL;
    }
  } else {
    game.moveSfxTimer = MOVE_SFX_INTERVAL;
  }

  if (game.player.weaponType === WEAPON_TYPES.gun) {
    if (input.fireHeld || input.firePressed) {
      fireGun();
    }
  } else if (input.firePressed) {
    fireHarpoon();
  }
  input.firePressed = false;

  updateHarpoons(dt);
  updateBullets(dt);
  updatePowerups(dt);
  if (isEndlessMode()) {
    game.endlessSpawnTimer -= dt;
    const cap = 4 + Math.min(8, Math.floor((game.levelIndex + 1) * 0.7));
    if (game.endlessSpawnTimer <= 0 && game.balls.length < cap) {
      const tuningNow = game.tuning || buildTuning(settings);
      const spec = buildEndlessSpecs(game.levelIndex + 1, 1)[0];
      game.balls.push(makeBall(spec, {
        radius: RADIUS,
        vxMag: tuningNow.vxMag,
        jumpSpeed: tuningNow.jumpSpeed,
        worldW: WORLD_W,
        floorY: FLOOR_Y,
      }));
      game.endlessSpawnTimer = Math.max(1.4, 3.6 - (game.levelIndex + 1) * 0.08);
    }
  }

  for (const ball of game.balls) {
    updateBall(ball, ballDt, {
      gravity: tuning.gravity,
      radius: RADIUS,
      jumpSpeed: tuning.jumpSpeed,
      vxMag: tuning.vxMag,
      capFactor: BALL_CAP_FACTOR,
      worldW: WORLD_W,
      floorY: FLOOR_Y,
      playerX: game.player.x,
    });
    for (const rect of solids) {
      collideBallWithSolid(ball, rect, RADIUS);
    }
    clampBallVelocity(ball, { jumpSpeed: tuning.jumpSpeed, vxMag: tuning.vxMag, capFactor: BALL_CAP_FACTOR });
  }

  if (game.harpoons.length) {
    for (let hi = game.harpoons.length - 1; hi >= 0; hi -= 1) {
      const h = game.harpoons[hi];
      let hit = false;
      for (let i = 0; i < game.balls.length; i += 1) {
        if (harpoonHitsBall(h, game.balls[i], RADIUS)) {
          splitBall(i);
          h.active = false;
          hit = true;
          break;
        }
      }
      if (hit) {
        game.harpoons.splice(hi, 1);
      }
    }
  }

  if (game.bullets.length) {
    for (let bi = game.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = game.bullets[bi];
      let hit = false;
      for (let i = 0; i < game.balls.length; i += 1) {
        const ball = game.balls[i];
        const rr = RADIUS[ball.size] + bullet.r;
        const dx = ball.x - bullet.x;
        const dy = ball.y - bullet.y;
        if (dx * dx + dy * dy <= rr * rr) {
          splitBall(i);
          hit = true;
          break;
        }
      }
      if (hit) {
        game.bullets.splice(bi, 1);
      }
    }
  }

  for (const ball of game.balls) {
    if (playerHitBall(ball)) {
      handlePlayerHit();
      break;
    }
  }

  if (game.state === GameState.PLAYING && game.balls.length === 0) {
    if (isEndlessMode()) {
      game.levelIndex += 1;
      game.geometry = cloneGeometryForRuntime(pickEndlessGeometry(game.levelIndex));
      spawnEndlessWave();
    } else {
      setLevelClear();
    }
  }
}

function update(dt) {
  if (game.state === GameState.LEVEL_START) {
    loadLevel();
    return;
  }

  if (game.state === GameState.PLAYER_HIT) {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      game.state = GameState.LEVEL_START;
    }
    return;
  }

  if (game.state === GameState.LEVEL_CLEAR) {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      game.levelIndex += 1;
      if (game.levelIndex >= LEVELS.length) {
        setGameOver('All levels cleared. Press R to restart.', false);
      } else {
        game.state = GameState.LEVEL_START;
      }
    }
    return;
  }

  if (game.state === GameState.GAME_OVER) {
    return;
  }

  updatePlaying(dt);
}

function drawGeometry(ctx2d, geometry) {
  const solids = geometry?.solids || [];
  if (solids.length) {
    for (const rect of solids) {
      const verticalish = rect.kind === 'barrier' || rect.h > rect.w;
      const decayAlpha = rect._destroyed
        ? clamp((Number(rect._crumble) || 0) / SOLID_CRUMBLE_DURATION, 0, 1)
        : 1;
      if (decayAlpha <= 0) continue;
      ctx2d.save();
      ctx2d.globalAlpha = decayAlpha;
      if (verticalish) {
        ctx2d.fillStyle = rect.destructible ? 'rgba(110, 52, 45, 0.7)' : 'rgba(41, 54, 72, 0.82)';
        ctx2d.strokeStyle = rect.destructible ? 'rgba(254, 202, 202, 0.58)' : 'rgba(148, 163, 184, 0.5)';
      } else {
        ctx2d.fillStyle = rect.destructible ? 'rgba(81, 54, 36, 0.74)' : 'rgba(15, 23, 42, 0.78)';
        ctx2d.strokeStyle = rect.destructible ? 'rgba(253, 186, 116, 0.55)' : 'rgba(148, 163, 184, 0.45)';
      }
      ctx2d.lineWidth = 1;
      ctx2d.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx2d.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      if (rect.destructible && !rect._destroyed) {
        const hp = Math.max(1, Number(rect._hp) || Number(rect.hitPoints) || 1);
        const cracks = Math.min(4, hp + 1);
        ctx2d.strokeStyle = verticalish ? 'rgba(254, 226, 226, 0.22)' : 'rgba(255, 237, 213, 0.24)';
        for (let i = 0; i < cracks; i += 1) {
          const fx = rect.x + (rect.w * (i + 1)) / (cracks + 1);
          ctx2d.beginPath();
          ctx2d.moveTo(fx - 3, rect.y + 2);
          ctx2d.lineTo(fx + 2, rect.y + rect.h - 2);
          ctx2d.stroke();
        }
      }
      ctx2d.restore();
    }
  }

  const ladders = geometry?.ladders || [];
  if (ladders.length) {
    ctx2d.strokeStyle = 'rgba(249, 115, 22, 0.55)';
    ctx2d.lineWidth = 1.5;
    for (const ladder of ladders) {
      ctx2d.strokeRect(ladder.x, ladder.y, ladder.w, ladder.h);
      const rungGap = 10;
      for (let y = ladder.y + 6; y < ladder.y + ladder.h; y += rungGap) {
        ctx2d.beginPath();
        ctx2d.moveTo(ladder.x + 3, y);
        ctx2d.lineTo(ladder.x + ladder.w - 3, y);
        ctx2d.stroke();
      }
    }
  }
}

function render() {
  drawBackground(ctx, WORLD_W, WORLD_H, FLOOR_Y, game.levelIndex);
  if (settings.showGeometry) {
    drawGeometry(ctx, game.geometry);
  }
  for (const h of game.harpoons) {
    drawHarpoon(ctx, h);
  }
  for (const bullet of game.bullets) {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.fillRect(bullet.x - 0.8, bullet.y + bullet.r, 1.6, 5);
  }
  for (const p of game.powerups) {
    const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r + 5);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
    ctx.fill();
    const colors = {
      shield: '#67e8f9',
      sticky: '#86efac',
      double: '#fca5a5',
      gun: '#fcd34d',
      slow: '#93c5fd',
      freeze: '#bfdbfe',
      dynamite: '#fb7185',
      life: '#34d399',
      single: '#f9a8d4',
      fruit: '#f59e0b',
    };
    ctx.fillStyle = colors[p.type] || '#e2e8f0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px monospace';
    const glyphMap = {
      shield: 'S',
      sticky: 'W',
      double: 'D',
      gun: 'G',
      slow: 'C',
      freeze: 'F',
      dynamite: 'X',
      life: '+',
      single: '1',
      fruit: '$',
    };
    const glyph = glyphMap[p.type] || '?';
    ctx.fillText(glyph, p.x - 3, p.y + 3);
  }
  for (const ball of game.balls) {
    drawBall(ctx, ball, RADIUS, BALL_COLORS);
  }
  const primaryHarpoon = game.harpoons.length ? game.harpoons[0] : null;
  drawPlayer(ctx, game.player, FLOOR_Y, primaryHarpoon);
  if (game.player.shieldCharges > 0) {
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y - game.player.h * 0.62, game.player.hitR + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  levelEl.textContent = (game.levelIndex + 1).toString();
  livesEl.textContent = game.lives.toString();
  if (timeEl) {
    if (isEndlessMode()) timeEl.textContent = '∞';
    else timeEl.textContent = game.levelTimeLeft.toFixed(1);
  }
  const weaponLabel = game.player.weaponType === WEAPON_TYPES.single ? 'harpoon' : game.player.weaponType;
  const timerLabel = game.player.weaponTimer > 0 ? ` ${game.player.weaponTimer.toFixed(1)}s` : '';
  const shieldLabel = game.player.shieldCharges > 0 ? ' shield' : '';
  const fxLabel = game.freezeTimer > 0
    ? ` freeze ${game.freezeTimer.toFixed(1)}s`
    : (game.slowTimer > 0 ? ` slow ${game.slowTimer.toFixed(1)}s` : '');
  statusEl.textContent = `${game.status} | ${weaponLabel}${timerLabel}${shieldLabel}${fxLabel}`;
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function isFireKey(ev) {
  return ev.code === 'Space' || ev.key === 'Enter';
}

function preventArrowScroll(ev) {
  const key = ev.key.toLowerCase();
  if (
    key === 'arrowleft' ||
    key === 'arrowright' ||
    key === 'arrowup' ||
    key === 'arrowdown' ||
    ev.code === 'Space'
  ) {
    ev.preventDefault();
  }
}

function handleKeyDown(ev) {
  if (settingsModal && !settingsModal.classList.contains('hidden')) {
    if (ev.key === 'Escape') {
      closeSettings();
      ev.preventDefault();
    }
    return;
  }
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    input.left = true;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    input.right = true;
    ev.preventDefault();
  }
  if (key === 'arrowup' || key === 'w') {
    input.up = true;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    input.down = true;
    ev.preventDefault();
  }
  if (isFireKey(ev)) {
    input.fireHeld = true;
    if (!ev.repeat) {
      input.firePressed = true;
    }
    ev.preventDefault();
  }
  if (key === 'r') {
    newGame();
    ev.preventDefault();
  }
}

function handleKeyUp(ev) {
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    input.left = false;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    input.right = false;
    ev.preventDefault();
  }
  if (key === 'arrowup' || key === 'w') {
    input.up = false;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    input.down = false;
    ev.preventDefault();
  }
  if (isFireKey(ev)) {
    input.fireHeld = false;
    ev.preventDefault();
  }
}

function loop() {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += (now - last) / 1000;
    last = now;
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    render();
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function installDebugApi() {
  window.__superBusterDebug = {
    getState() {
      return {
        state: game.state,
        status: game.status,
        levelIndex: game.levelIndex,
        levelTimeLeft: game.levelTimeLeft,
        lives: game.lives,
        score: game.score,
        player: clonePlain(game.player),
        harpoon: clonePlain(game.harpoons[0] || { active: false, x: 0, yBottom: FLOOR_Y, yTop: FLOOR_Y, state: 'extend', timer: 0 }),
        harpoons: clonePlain(game.harpoons),
        bullets: clonePlain(game.bullets),
        powerups: clonePlain(game.powerups),
        balls: clonePlain(game.balls),
        geometry: clonePlain(game.geometry),
      settings: clonePlain(settings),
        tuning: clonePlain(game.tuning),
      };
    },
    setBall(index, patch) {
      if (!game.balls[index]) return false;
      Object.assign(game.balls[index], patch);
      return true;
    },
    setPlayerX(x) {
      game.player.x = clamp(Number(x), game.player.w / 2, WORLD_W - game.player.w / 2);
    },
    setPlayer(patch) {
      Object.assign(game.player, patch || {});
    },
    spawnPowerup(type, x, y) {
      if (spawnPowerup(type, x, y)) {
        const p = game.powerups[game.powerups.length - 1];
        p.vy = 0;
      }
    },
    forcePlayerHit() {
      handlePlayerHit();
    },
    clearBalls() {
      game.balls = [];
    },
  };
}

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
document.addEventListener('pointerdown', unlockAudio, { once: true });
settingsToggle?.addEventListener('click', (ev) => {
  ev.stopPropagation();
  openSettings();
});
settingsClose?.addEventListener('click', closeSettings);
settingsCancel?.addEventListener('click', closeSettings);
settingsApply?.addEventListener('click', applySettingsFromModal);
settingsModal?.addEventListener('click', (ev) => {
  if (ev.target === settingsModal) closeSettings();
});

initGameShell({
  surfaceEl: '#buster-surface',
  canvasEl: canvas,
  baseWidth: WORLD_W,
  baseHeight: WORLD_H,
  canvasBias: 'wide',
  mode: 'fractional',
  fit: 'css',
});

installDebugApi();

async function start() {
  applySettingsToRuntime(null);
  await tryLoadExternalLevelPack();
  newGame();
  loop();
}

start();
