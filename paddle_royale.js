import { SfxEngine } from './sfx_engine.js';
import { BANK_PADDLEROYALE } from './sfx_bank_paddle_royale.js';
import { initGameShell } from './game-shell.js';
import {
  drawBalls as drawSpriteBalls,
  drawBallTrails as drawSpriteBallTrails,
  drawExplosions as drawSpriteExplosions,
  drawStageBackground as drawSpriteStageBackground,
  drawBricks as drawSpriteBricks,
  drawBullets as drawSpriteBullets,
  drawCapsules as drawSpriteCapsules,
  drawPaddle as drawSpritePaddle,
} from './paddle_royale_sprite.js';
import {
  BRICK_LAYOUT_COLS,
  BRICK_LAYOUT_ROWS,
  TOTAL_STAGES,
  SPEED_COUNTER_TABLE,
  capsuleCountForStage,
  getStageRows,
  silverHitsForStage,
  silverPointsForStage,
  speedValuesForDifficulty,
} from './paddle_royale_levels.js';

const canvas = document.getElementById('paddle-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const highEl = document.getElementById('high');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const dipLives = document.getElementById('dip-lives');
const dipBonus = document.getElementById('dip-bonus');
const dipDifficulty = document.getElementById('dip-difficulty');
const dipSpeed = document.getElementById('dip-speed');
const dipContinue = document.getElementById('dip-continue');
const dipTrails = document.getElementById('dip-trails');
const dipSounds = document.getElementById('dip-sounds');
const dipExplosions = document.getElementById('dip-explosions');

const sfx = new SfxEngine({ master: 0.5 });
let audioUnlocked = false;

const W = canvas.width;
const H = canvas.height;
const FIXED_DT = 1000 / 60;

const BASE_PADDLE_W = 80;
const EXPANDED_PADDLE_W = 122;
const PADDLE_H = 12;
const PADDLE_Y = H - 40;
const PADDLE_SPEED = 6;

const BALL_R = 6;
const BULLET_W = 4;
const BULLET_H = 10;
const BULLET_SPEED = 10;

const BRICK_ROWS = BRICK_LAYOUT_ROWS;
const BRICK_COLS = BRICK_LAYOUT_COLS;
const BRICK_W = W / BRICK_COLS;
const BRICK_H = 16;
const BRICK_OFFSET_Y = 60;
const BREAK_GATE_TOP = Math.floor(H * 0.64);
const BREAK_GATE_BOTTOM = BREAK_GATE_TOP + 72;
const CATCH_AUTO_RELEASE_FRAMES = 120;

const STORAGE_HIGH = 'paddle_royale.high';
const STORAGE_SETTINGS = 'paddle_royale.settings';

const State = {
  IDLE: 0,
  READY: 1,
  PLAYING: 2,
  PAUSED: 3,
  DEAD: 4,
  LEVEL_COMPLETE: 5,
  WON: 6,
};

const BrickType = {
  NORMAL: 'normal',
  SILVER: 'silver',
  GOLD: 'gold',
};

const CapsuleType = {
  EXPAND: 'E',
  SLOW: 'S',
  CATCH: 'C',
  DISRUPTION: 'D',
  LASER: 'L',
  BREAK: 'B',
  PLAYER: 'P',
};

const BRICK_COLORS = ['#fcfcfc', '#fc7460', '#3cbcfc', '#80d010', '#d82800', '#0070ec', '#fc74b4', '#fc9838'];
const BRICK_POINTS = [50, 60, 70, 80, 90, 100, 110, 120];
const DEFAULT_SETTINGS = {
  lives: '3',
  bonus: '20_60',
  difficulty: 'easy',
  speed: 'normal',
  continueMode: 'with',
  trails: 'on',
  sounds: 'on',
  explosions: 'on',
};


const CAPSULE_WEIGHTS = [
  CapsuleType.EXPAND,
  CapsuleType.SLOW,
  CapsuleType.CATCH,
  CapsuleType.DISRUPTION,
  CapsuleType.LASER,
  CapsuleType.BREAK,
  CapsuleType.PLAYER,
  CapsuleType.EXPAND,
  CapsuleType.SLOW,
  CapsuleType.CATCH,
  CapsuleType.DISRUPTION,
  CapsuleType.LASER,
  CapsuleType.BREAK,
  CapsuleType.EXPAND,
  CapsuleType.SLOW,
];


let state = State.IDLE;
let settings = loadSettings();

let paddle = {
  x: W / 2 - BASE_PADDLE_W / 2,
  vx: 0,
  width: BASE_PADDLE_W,
  laserCooldown: 0,
};

let balls = [];
let bullets = [];
let capsules = [];
let bricks = [];

let stage = 1;
let score = 0;
let lives = parseInt(settings.lives, 10);
let highScore = parseInt(localStorage.getItem(STORAGE_HIGH), 10) || 0;
let keys = {};
let accum = 0;
let lastTime = 0;
let levelCompleteTimer = 0;
let speedCounter = 0;
let speedIndex = 0;
let nextBonusLifeScore = 20000;
let bonusClaimed = 0;
let brickHitStreak = 0;
let brickStreakTimer = 0;
let catchReleaseTimer = 0;
let explosions = [];
let breakableBrickCount = 0;

let effects = {
  expand: false,
  catch: false,
  laser: false,
  breakGate: false,
};

highEl.textContent = highScore;
syncSettingsUI(settings);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeSettings(next) {
  const lives = next.lives === '5' ? '5' : '3';
  const bonus = next.bonus === '20_only' ? '20_only' : '20_60';
  const difficulty = next.difficulty === 'hard' ? 'hard' : 'easy';
  const speed = next.speed === 'turbo' ? 'turbo' : next.speed === 'fast' ? 'fast' : 'normal';
  const continueMode = next.continueMode === 'without' ? 'without' : 'with';
  const trails = next.trails === 'off' ? 'off' : 'on';
  const sounds = next.sounds === 'off' ? 'off' : 'on';
  const explosions = next.explosions === 'off' ? 'off' : 'on';
  return { lives, bonus, difficulty, speed, continueMode, trails, sounds, explosions };
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{}');
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...raw });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(next));
}

function syncSettingsUI(next) {
  if (!dipLives) return;
  dipLives.value = next.lives;
  dipBonus.value = next.bonus;
  dipDifficulty.value = next.difficulty;
  dipSpeed.value = next.speed;
  dipContinue.value = next.continueMode;
  dipTrails.value = next.trails;
  dipSounds.value = next.sounds;
  dipExplosions.value = next.explosions;
}

function applySettingsFromUI() {
  const next = sanitizeSettings({
    lives: dipLives.value,
    bonus: dipBonus.value,
    difficulty: dipDifficulty.value,
    speed: dipSpeed.value,
    continueMode: dipContinue.value,
    trails: dipTrails.value,
    sounds: dipSounds.value,
    explosions: dipExplosions.value,
  });
  settings = next;
  sfx.setEnabled(settings.sounds === 'on');
  if (settings.explosions !== 'on') explosions = [];
  if (settings.trails !== 'on') balls.forEach((b) => { b.trail = []; });
  saveSettings(next);
  syncSettingsUI(next);
  startGame();
}

function isSettingsOpen() {
  return settingsModal && !settingsModal.classList.contains('hidden');
}

function openSettings() {
  syncSettingsUI(settings);
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
  if (state === State.PLAYING) {
    state = State.PAUSED;
    pauseBtn.textContent = 'Resume';
  }
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function currentBallSpeed() {
  const table = speedValuesForDifficulty(settings.difficulty);
  return table[clamp(speedIndex, 0, table.length - 1)] * gameSpeedFactor();
}

function gameSpeedFactor() {
  if (settings.speed === 'turbo') return 1.3;
  if (settings.speed === 'fast') return 1.15;
  return 1;
}

function chooseCapsule(rand) {
  const idx = Math.floor(rand() * CAPSULE_WEIGHTS.length);
  return CAPSULE_WEIGHTS[clamp(idx, 0, CAPSULE_WEIGHTS.length - 1)];
}

function assignStageCapsules(stageNum) {
  const rand = seededRandom(stageNum * 101 + 17);
  // Capsules come from breakable non-silver bricks.
  const candidates = bricks.filter((b) => b.type === BrickType.NORMAL);
  const count = Math.min(candidates.length, capsuleCountForStage(stageNum));

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  for (let i = 0; i < count; i++) {
    candidates[i].capsule = chooseCapsule(rand);
  }
}

function makeBall(stuck = false, x = 0, y = 0) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    stuck,
    served: false,
    trail: [],
  };
}

function getMainBall() {
  return balls.find((b) => !b.stuck) || balls[0] || null;
}

function resetPaddle() {
  paddle.width = effects.expand ? EXPANDED_PADDLE_W : BASE_PADDLE_W;
  paddle.x = W / 2 - paddle.width / 2;
  paddle.vx = 0;
  paddle.laserCooldown = 0;
}

function clearPersistentCapsuleEffects() {
  effects.expand = false;
  effects.catch = false;
  effects.laser = false;
  effects.breakGate = false;
  catchReleaseTimer = 0;
}

function clearRoundObjects() {
  balls = [];
  bullets = [];
  capsules = [];
  explosions = [];
}

function resetBallsForServe() {
  clearRoundObjects();
  const b = makeBall(true);
  b.x = paddle.x + paddle.width / 2;
  b.y = PADDLE_Y - BALL_R - 2;
  balls.push(b);
}

function clearTransientEffectsOnLifeLoss() {
  clearPersistentCapsuleEffects();
  paddle.width = BASE_PADDLE_W;
}

function initStage() {
  bricks = [];
  explosions = [];
  breakableBrickCount = 0;
  const rows = getStageRows(stage);
  const silverHits = silverHitsForStage(stage);

  for (let r = 0; r < BRICK_ROWS; r++) {
    const row = rows[r] || '.'.repeat(BRICK_COLS);
    for (let c = 0; c < BRICK_COLS; c++) {
      const ch = row[c] || '.';
      if (ch === '.') continue;

      let type = BrickType.NORMAL;
      let hits = 1;
      let points = 50;
      let colorIndex = 0;

      if (ch === 'S') {
        type = BrickType.SILVER;
        hits = silverHits;
        points = silverPointsForStage(stage);
        colorIndex = 7;
      } else if (ch === 'G') {
        type = BrickType.GOLD;
        hits = 999;
        points = 0;
        colorIndex = 0;
      } else {
        const n = clamp(parseInt(ch, 10), 1, 9);
        colorIndex = (n - 1) % BRICK_COLORS.length;
        points = BRICK_POINTS[colorIndex];
      }

      bricks.push({
        x: c * BRICK_W,
        y: BRICK_OFFSET_Y + r * BRICK_H,
        w: BRICK_W,
        h: BRICK_H,
        row: r,
        col: c,
        type,
        hits,
        maxHits: hits,
        points,
        colorIndex,
        capsule: null,
      });
      if (type !== BrickType.GOLD) breakableBrickCount += 1;
    }
  }

  assignStageCapsules(stage);
  speedCounter = 0;
  speedIndex = settings.difficulty === 'hard' ? 2 : 1;
  resetPaddle();
  resetBallsForServe();
  updateHud();
}

function launchStuckBalls() {
  const targets = balls.filter((b) => b.stuck);
  if (targets.length === 0) return;
  catchReleaseTimer = 0;
  sfx.play(BANK_PADDLEROYALE, 'serve', { balls: targets.length });
  const speed = currentBallSpeed();

  targets.forEach((b, idx) => {
    const spread = (idx - (targets.length - 1) / 2) * 0.22;
    const angle = b.catchAngle ?? (-Math.PI / 2 + spread);
    b.stuck = false;
    b.served = true;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.catchOffsetX = null;
    b.catchAngle = null;
  });

  state = State.PLAYING;
  statusEl.textContent = `Stage ${stage} in progress.`;
}

function startGame() {
  score = 0;
  stage = 1;
  lives = parseInt(settings.lives, 10);
  bonusClaimed = 0;
  nextBonusLifeScore = 20000;
  clearTransientEffectsOnLifeLoss();
  state = State.READY;
  initStage();
  sfx.play(BANK_PADDLEROYALE, 'stageStart', { stage });
  statusEl.textContent = 'Press Space or click to launch.';
  render();
}

function continueGame() {
  if (state !== State.DEAD || settings.continueMode !== 'with') return;
  lives = 1;
  clearTransientEffectsOnLifeLoss();
  state = State.READY;
  initStage();
  sfx.play(BANK_PADDLEROYALE, 'continue');
  statusEl.textContent = `Continue: Stage ${stage}. Launch when ready.`;
}

function nextStage() {
  if (stage >= TOTAL_STAGES) {
    state = State.WON;
    sfx.play(BANK_PADDLEROYALE, 'gameWin');
    statusEl.textContent = `All ${TOTAL_STAGES} stages cleared! Press R for a new run.`;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_HIGH, highScore);
      highEl.textContent = highScore;
    }
    return;
  }

  stage += 1;
  state = State.READY;
  initStage();
  sfx.play(BANK_PADDLEROYALE, 'stageStart', { stage });
  statusEl.textContent = `Stage ${stage}. Press Space or click to launch.`;
  render();
}

function awardScore(amount) {
  score += amount;

  if (settings.bonus === '20_60') {
    while (score >= nextBonusLifeScore) {
      lives += 1;
      nextBonusLifeScore += 60000;
      sfx.play(BANK_PADDLEROYALE, 'extraLife');
    }
  } else if (settings.bonus === '20_only' && bonusClaimed === 0 && score >= 20000) {
    lives += 1;
    bonusClaimed = 1;
    sfx.play(BANK_PADDLEROYALE, 'extraLife');
  }

  updateHud();
}

function loseLife() {
  lives -= 1;
  clearTransientEffectsOnLifeLoss();

  if (lives <= 0) {
    state = State.DEAD;
    sfx.play(BANK_PADDLEROYALE, 'gameOver');
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_HIGH, highScore);
      highEl.textContent = highScore;
    }
    if (settings.continueMode === 'with') {
      statusEl.textContent = `Game over on Stage ${stage}. Press C to continue or R for new game.`;
    } else {
      statusEl.textContent = `Game over on Stage ${stage}. Press R or New Game.`;
    }
  } else {
    state = State.READY;
    sfx.play(BANK_PADDLEROYALE, 'lifeLost', { lives });
    resetPaddle();
    resetBallsForServe();
    statusEl.textContent = `${lives} lives left. Press Space or click to launch.`;
  }

  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  levelEl.textContent = stage;
  livesEl.textContent = lives;
}

function normalizeBallVelocity(ball) {
  const speed = currentBallSpeed();
  const len = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / len) * speed;
  ball.vy = (ball.vy / len) * speed;
}

function bumpSpeedCounter() {
  speedCounter += 1;
  const maxIndex = SPEED_COUNTER_TABLE.length - 1;
  if (speedIndex < maxIndex && speedCounter >= SPEED_COUNTER_TABLE[speedIndex]) {
    speedCounter = 0;
    speedIndex += 1;
    balls.forEach((b) => {
      if (!b.stuck) normalizeBallVelocity(b);
    });
  }
}

function applyCapsule(type) {
  sfx.play(BANK_PADDLEROYALE, 'capsuleCatch', { type });
  switch (type) {
    case CapsuleType.EXPAND:
      clearPersistentCapsuleEffects();
      effects.expand = true;
      paddle.width = EXPANDED_PADDLE_W;
      paddle.x = clamp(paddle.x, 0, W - paddle.width);
      sfx.play(BANK_PADDLEROYALE, 'capsuleExpand');
      break;
    case CapsuleType.SLOW:
      speedIndex = Math.max(0, speedIndex - 2);
      speedCounter = 0;
      balls.forEach((b) => {
        if (!b.stuck) normalizeBallVelocity(b);
      });
      sfx.play(BANK_PADDLEROYALE, 'capsuleSlow');
      break;
    case CapsuleType.CATCH:
      clearPersistentCapsuleEffects();
      effects.catch = true;
      sfx.play(BANK_PADDLEROYALE, 'capsuleCatchMode');
      break;
    case CapsuleType.DISRUPTION:
      createDisruptionBalls();
      break;
    case CapsuleType.LASER:
      clearPersistentCapsuleEffects();
      effects.laser = true;
      sfx.play(BANK_PADDLEROYALE, 'capsuleLaser');
      break;
    case CapsuleType.BREAK:
      clearPersistentCapsuleEffects();
      effects.breakGate = true;
      sfx.play(BANK_PADDLEROYALE, 'capsuleBreak');
      break;
    case CapsuleType.PLAYER:
      lives += 1;
      updateHud();
      sfx.play(BANK_PADDLEROYALE, 'extraLife');
      break;
    default:
      break;
  }
}

function createDisruptionBalls() {
  const seed = getMainBall();
  if (!seed || seed.stuck) return;

  const speed = currentBallSpeed();
  const baseAngle = Math.atan2(seed.vy, seed.vx);
  const spread = [-0.35, 0.35];

  spread.forEach((off) => {
    const b = makeBall(false, seed.x, seed.y);
    b.served = true;
    b.vx = Math.cos(baseAngle + off) * speed;
    b.vy = Math.sin(baseAngle + off) * speed;
    balls.push(b);
  });
  sfx.play(BANK_PADDLEROYALE, 'multiball');
}

function spawnCapsule(brick) {
  if (!brick.capsule) return;
  // Arcade behavior: only normal bricks can drop capsules, only one falling at a time,
  // and no new capsule spawns during disruption (multi-ball).
  if (brick.type !== BrickType.NORMAL) return;
  if (capsules.length > 0) return;
  if (balls.length > 1) return;
  capsules.push({
    x: brick.x + brick.w / 2,
    y: brick.y + brick.h / 2,
    vy: (settings.difficulty === 'hard' ? 2.5 : 2.1) * gameSpeedFactor(),
    type: brick.capsule,
  });
  sfx.play(BANK_PADDLEROYALE, 'capsuleDrop', { type: brick.capsule });
  brick.capsule = null;
}

function spawnBrickExplosion(brick) {
  if (settings.explosions !== 'on') return;
  const cx = brick.x + brick.w * 0.5;
  const cy = brick.y + brick.h * 0.5;
  const count = 10 + Math.floor(Math.random() * 5);
  const baseColor = BRICK_COLORS[clamp(brick.colorIndex, 0, BRICK_COLORS.length - 1)] || '#fbbf24';

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2 + Math.random() * 0.35;
    const speed = 1.4 + Math.random() * 2.2;
    explosions.push({
      x: cx,
      y: cy,
      vx: Math.cos(t) * speed,
      vy: Math.sin(t) * speed - 0.25,
      life: 20 + Math.floor(Math.random() * 14),
      maxLife: 34,
      size: 2 + Math.random() * 3.5,
      color: baseColor,
    });
  }
}

function removeBrickAt(index) {
  const [removed] = bricks.splice(index, 1);
  if (removed && removed.type !== BrickType.GOLD) {
    breakableBrickCount = Math.max(0, breakableBrickCount - 1);
  }
}

function damageBrick(brick, sourceIsBall) {
  if (brick.type === BrickType.GOLD) {
    sfx.play(BANK_PADDLEROYALE, 'goldHit');
    return false;
  }

  brick.hits -= 1;
  brickHitStreak = Math.min(16, brickHitStreak + 1);
  brickStreakTimer = 20;
  sfx.play(BANK_PADDLEROYALE, 'brickHit', {
    row: brick.row,
    streak: brickHitStreak,
    type: brick.type,
    hp: brick.hits,
    maxHp: brick.maxHits,
  });
  if (brick.type === BrickType.SILVER && brick.hits > 0) {
    sfx.play(BANK_PADDLEROYALE, 'silverHit', { hp: brick.hits, maxHp: brick.maxHits });
  }

  if (brick.hits <= 0) {
    awardScore(brick.points);
    spawnCapsule(brick);
    spawnBrickExplosion(brick);
    if (settings.explosions === 'on') {
      sfx.play(BANK_PADDLEROYALE, 'explosion', { row: brick.row, type: brick.type });
    }
    sfx.play(BANK_PADDLEROYALE, 'brickBreak', { row: brick.row, type: brick.type, streak: brickHitStreak });
    return true;
  }

  return false;
}

function fireLaser() {
  if (!effects.laser || state !== State.PLAYING) return;
  if (paddle.laserCooldown > 0) return;

  const vy = -BULLET_SPEED * gameSpeedFactor();
  bullets.push({ x: paddle.x + 10, y: PADDLE_Y - 2, vy });
  bullets.push({ x: paddle.x + paddle.width - 10, y: PADDLE_Y - 2, vy });
  paddle.laserCooldown = 16;
  sfx.play(BANK_PADDLEROYALE, 'laserFire');
}

function movePaddleFromClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const x = ((clientX - rect.left) / rect.width) * W;
  paddle.x = clamp(x - paddle.width / 2, 0, W - paddle.width);
}

function ballHitsPaddle(ball) {
  return (
    ball.y + BALL_R >= PADDLE_Y &&
    ball.y - BALL_R < PADDLE_Y + PADDLE_H &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width &&
    ball.vy > 0
  );
}

function handleBallPaddleCollision(ball) {
  if (!ballHitsPaddle(ball)) return;

  ball.y = PADDLE_Y - BALL_R;
  const speed = currentBallSpeed();
  const hitPos = (ball.x - paddle.x) / paddle.width;
  const angle = (-150 + hitPos * 120) * (Math.PI / 180);

  if (effects.catch && !effects.laser) {
    // Keep the ball at the exact catch position and preserve relaunch angle.
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.catchOffsetX = clamp(ball.x - paddle.x, BALL_R, paddle.width - BALL_R);
    ball.catchAngle = angle;
    catchReleaseTimer = CATCH_AUTO_RELEASE_FRAMES;
    statusEl.textContent = 'Caught. Press Space or click to relaunch.';
    sfx.play(BANK_PADDLEROYALE, 'paddleHit');
    return;
  }

  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  bumpSpeedCounter();
  sfx.play(BANK_PADDLEROYALE, 'paddleHit');
}

function getBallBrickCollision(ball, brick) {
  if (
    ball.x + BALL_R <= brick.x ||
    ball.x - BALL_R >= brick.x + brick.w ||
    ball.y + BALL_R <= brick.y ||
    ball.y - BALL_R >= brick.y + brick.h
  ) {
    return null;
  }

  const overlapLeft = ball.x + BALL_R - brick.x;
  const overlapRight = brick.x + brick.w - (ball.x - BALL_R);
  const overlapTop = ball.y + BALL_R - brick.y;
  const overlapBottom = brick.y + brick.h - (ball.y - BALL_R);
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapLeft || minOverlap === overlapRight) return 'x';
  return 'y';
}

function updateBalls() {
  const keep = [];

  for (const ball of balls) {
    if (ball.stuck) {
      const offset = ball.catchOffsetX != null ? ball.catchOffsetX : paddle.width / 2;
      ball.x = paddle.x + offset;
      ball.y = PADDLE_Y - BALL_R - 2;
      ball.trail = [];
      keep.push(ball);
      continue;
    }

    if (settings.trails === 'on') {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 10) ball.trail.shift();
    } else {
      ball.trail = [];
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (effects.breakGate && ball.vx > 0 && ball.x + BALL_R >= W && ball.y >= BREAK_GATE_TOP && ball.y <= BREAK_GATE_BOTTOM) {
      awardScore(10000);
      state = State.LEVEL_COMPLETE;
      levelCompleteTimer = 36;
      bullets = [];
      capsules = [];
      clearPersistentCapsuleEffects();
      sfx.play(BANK_PADDLEROYALE, 'levelComplete');
      statusEl.textContent = `Break warp! +10000`;
      balls = keep;
      return;
    }

    if (ball.x - BALL_R <= 0 || ball.x + BALL_R >= W) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, BALL_R, W - BALL_R);
      bumpSpeedCounter();
      sfx.play(BANK_PADDLEROYALE, 'wallHit');
    }

    if (ball.y - BALL_R <= 0) {
      ball.vy *= -1;
      ball.y = BALL_R;
      bumpSpeedCounter();
      sfx.play(BANK_PADDLEROYALE, 'wallHit');
    }

    handleBallPaddleCollision(ball);

    let removedBrick = false;
    for (let i = bricks.length - 1; i >= 0; i--) {
      const brick = bricks[i];
      const axis = getBallBrickCollision(ball, brick);
      if (!axis) continue;

      const broke = damageBrick(brick, true);
      if (broke) {
        removeBrickAt(i);
        removedBrick = true;
      }

      if (axis === 'x') ball.vx *= -1;
      else ball.vy *= -1;

      normalizeBallVelocity(ball);
      bumpSpeedCounter();
      break;
    }

    if (removedBrick) {
      // Keep loop behavior deterministic by handling one brick per frame per ball.
    }

    if (ball.y - BALL_R > H) {
      continue;
    }

    keep.push(ball);
  }

  balls = keep;
}

function updateBullets() {
  if (paddle.laserCooldown > 0) paddle.laserCooldown -= 1;
  if (bullets.length === 0) return;

  const alive = [];
  for (const bullet of bullets) {
    bullet.y += bullet.vy;
    if (bullet.y + BULLET_H < 0) continue;

    let hit = false;
    for (let i = bricks.length - 1; i >= 0; i--) {
      const brick = bricks[i];
      if (brick.type === BrickType.GOLD) continue;

      const bx = bullet.x - BULLET_W / 2;
      const by = bullet.y - BULLET_H;
      if (
        bx < brick.x + brick.w &&
        bx + BULLET_W > brick.x &&
        by < brick.y + brick.h &&
        by + BULLET_H > brick.y
      ) {
        const broke = damageBrick(brick, false);
        if (broke) removeBrickAt(i);
        sfx.play(BANK_PADDLEROYALE, 'laserHit', { row: brick.row });
        hit = true;
        break;
      }
    }

    if (!hit) alive.push(bullet);
  }

  bullets = alive;
}

function updateCapsules() {
  if (capsules.length === 0) return;

  const keep = [];
  for (const cap of capsules) {
    cap.y += cap.vy;

    const caught =
      cap.y >= PADDLE_Y - 2 &&
      cap.y <= PADDLE_Y + PADDLE_H + 8 &&
      cap.x >= paddle.x &&
      cap.x <= paddle.x + paddle.width;

    if (caught) {
      applyCapsule(cap.type);
      continue;
    }

    if (cap.y <= H + 20) keep.push(cap);
  }

  capsules = keep;
}

function updateExplosions() {
  if (settings.explosions !== 'on') {
    if (explosions.length) explosions = [];
    return;
  }
  if (explosions.length === 0) return;
  const next = [];
  for (const p of explosions) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + 0.08;
    p.life -= 1;
    if (p.life > 0) next.push(p);
  }
  explosions = next;
}

function tick() {
  if (state !== State.PLAYING && state !== State.READY) return;
  if (brickStreakTimer > 0) {
    brickStreakTimer -= 1;
    if (brickStreakTimer === 0) brickHitStreak = 0;
  }

  if (keys.arrowleft || keys.a) paddle.vx = -PADDLE_SPEED;
  else if (keys.arrowright || keys.d) paddle.vx = PADDLE_SPEED;
  else paddle.vx = 0;

  paddle.x += paddle.vx;
  paddle.x = clamp(paddle.x, 0, W - paddle.width);

  if (state === State.READY) {
    for (const b of balls) {
      if (b.stuck) {
        const offset = b.catchOffsetX != null ? b.catchOffsetX : paddle.width / 2;
        b.x = paddle.x + offset;
        b.y = PADDLE_Y - BALL_R - 2;
      }
    }
  }

  if (effects.catch && catchReleaseTimer > 0 && balls.some((b) => b.stuck)) {
    catchReleaseTimer -= 1;
    if (catchReleaseTimer <= 0) launchStuckBalls();
  }

  if (state !== State.PLAYING) return;

  updateBalls();
  if (state !== State.PLAYING) return;
  updateBullets();
  updateCapsules();

  if (balls.length === 0) {
    loseLife();
    return;
  }

  if (breakableBrickCount === 0) {
    state = State.LEVEL_COMPLETE;
    levelCompleteTimer = 90;
    bullets = [];
    capsules = [];
    sfx.play(BANK_PADDLEROYALE, 'levelComplete');
    statusEl.textContent = `Stage ${stage} clear!`;
  }
}

function drawOverlay() {
  if (state !== State.PAUSED && state !== State.DEAD && state !== State.WON) return;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';

  if (state === State.PAUSED) ctx.fillText('PAUSED', W / 2, H / 2);
  if (state === State.DEAD) ctx.fillText('GAME OVER', W / 2, H / 2);
  if (state === State.WON) ctx.fillText('ALL CLEAR', W / 2, H / 2);
}

function render() {
  drawSpriteStageBackground(ctx, W, H, stage);

  if (effects.breakGate) {
    ctx.save();
    ctx.fillStyle = 'rgba(244, 114, 182, 0.18)';
    ctx.fillRect(W - 8, BREAK_GATE_TOP, 8, BREAK_GATE_BOTTOM - BREAK_GATE_TOP);
    ctx.strokeStyle = 'rgba(251, 207, 232, 0.72)';
    ctx.lineWidth = 2;
    ctx.strokeRect(W - 7, BREAK_GATE_TOP + 1, 6, BREAK_GATE_BOTTOM - BREAK_GATE_TOP - 2);
    ctx.restore();
  }

  drawSpriteBricks(ctx, bricks, BRICK_COLORS, stage);
  if (settings.trails === 'on') drawSpriteBallTrails(ctx, balls);
  if (settings.explosions === 'on') drawSpriteExplosions(ctx, explosions);
  drawSpritePaddle(ctx, paddle, PADDLE_Y, effects);
  drawSpriteBalls(ctx, balls, effects);
  drawSpriteBullets(ctx, bullets, BULLET_W, BULLET_H);
  drawSpriteCapsules(ctx, capsules);
  drawOverlay();
}

function togglePause() {
  if (isSettingsOpen()) return;

  if (state === State.PLAYING || state === State.READY) {
    state = State.PAUSED;
    sfx.play(BANK_PADDLEROYALE, 'pause');
    statusEl.textContent = 'Paused. Press P to resume.';
    pauseBtn.textContent = 'Resume';
    render();
  } else if (state === State.PAUSED) {
    state = balls.some((b) => !b.stuck) ? State.PLAYING : State.READY;
    sfx.play(BANK_PADDLEROYALE, 'resume');
    statusEl.textContent = state === State.PLAYING ? `Stage ${stage} in progress.` : 'Ready to launch.';
    pauseBtn.textContent = 'Pause';
  }
}

function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;
  accum += dt;

  while (accum >= FIXED_DT) {
    accum -= FIXED_DT;

    if (state === State.LEVEL_COMPLETE) {
      levelCompleteTimer -= 1;
      if (levelCompleteTimer <= 0) nextStage();
    } else {
      tick();
    }
    if (settings.explosions === 'on' && state !== State.PAUSED && state !== State.DEAD && state !== State.WON) {
      updateExplosions();
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }

  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === 'escape' && isSettingsOpen()) {
    closeSettings();
    return;
  }

  if (isSettingsOpen()) {
    e.preventDefault();
    return;
  }

  if (key === 'r') {
    startGame();
    return;
  }

  if (key === 'c') {
    continueGame();
    return;
  }

  if (key === 'p') {
    togglePause();
    return;
  }

  if (key === ' ') {
    e.preventDefault();
    if (state === State.READY || state === State.IDLE) {
      if (state === State.IDLE) startGame();
      launchStuckBalls();
      return;
    }
    if (state === State.PLAYING && balls.some((b) => b.stuck)) {
      launchStuckBalls();
      return;
    }
    if (state === State.PLAYING) fireLaser();
    return;
  }

  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', ' '].includes(key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('pointermove', (ev) => {
  if (isSettingsOpen()) return;
  movePaddleFromClientX(ev.clientX);
});

function handleCanvasTap(clientX) {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }
  if (isSettingsOpen()) return;
  movePaddleFromClientX(clientX);
  if (state === State.READY || state === State.IDLE) {
    if (state === State.IDLE) startGame();
    launchStuckBalls();
    return;
  }
  if (state === State.PLAYING && balls.some((b) => b.stuck)) {
    launchStuckBalls();
    return;
  }
  if (state === State.PLAYING) fireLaser();
}

canvas.style.touchAction = 'none';

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  handleCanvasTap(ev.clientX);
});

// Fallback touch listeners for browsers/devices with unreliable pointer events.
canvas.addEventListener('touchstart', (ev) => {
  if (ev.touches.length === 0) return;
  ev.preventDefault();
  handleCanvasTap(ev.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchmove', (ev) => {
  if (isSettingsOpen() || ev.touches.length === 0) return;
  ev.preventDefault();
  movePaddleFromClientX(ev.touches[0].clientX);
}, { passive: false });

newBtn.addEventListener('click', () => {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }
  startGame();
});

pauseBtn.addEventListener('click', () => {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }
  togglePause();
});

settingsToggle?.addEventListener('click', () => openSettings());
settingsClose?.addEventListener('click', () => closeSettings());
settingsCancel?.addEventListener('click', () => closeSettings());
settingsModal?.addEventListener('click', (ev) => {
  if (ev.target === settingsModal) closeSettings();
});
settingsApply?.addEventListener('click', () => {
  applySettingsFromUI();
  closeSettings();
});

sfx.setEnabled(settings.sounds === 'on');
initGameShell({
  shellEl: '.paddle-board',
  surfaceEl: '#paddle-surface',
  canvasEl: canvas,
  baseWidth: W,
  baseHeight: H,
  mode: 'fractional',
  fit: 'css',
});
startGame();
render();
requestAnimationFrame(gameLoop);

