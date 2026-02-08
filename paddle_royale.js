import { SfxEngine } from './sfx_engine.js';
import { BANK_PADDLEROYALE } from './sfx_bank_paddle_royale.js';
import {
  drawBalls as drawSpriteBalls,
  drawBricks as drawSpriteBricks,
  drawBullets as drawSpriteBullets,
  drawCapsules as drawSpriteCapsules,
  drawPaddle as drawSpritePaddle,
} from './paddle_royale_sprite.js';

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
const dipContinue = document.getElementById('dip-continue');

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

const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const BRICK_W = W / BRICK_COLS;
const BRICK_H = 20;
const BRICK_OFFSET_Y = 60;
const TOTAL_STAGES = 33;

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

const BRICK_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'];
const BRICK_POINTS = [50, 60, 70, 80, 90, 100, 110, 120];
const SILVER_BASE_POINTS = 50;

const DEFAULT_SETTINGS = {
  lives: '3',
  bonus: '20_60',
  difficulty: 'easy',
  continueMode: 'with',
};

const SPEED_VALUES_EASY = [
  3.3, 3.55, 3.8, 4.05, 4.3, 4.55, 4.8, 5.05,
  5.3, 5.55, 5.8, 6.05, 6.3, 6.55, 6.8, 7.05,
];
const SPEED_VALUES_HARD = [
  3.7, 3.95, 4.2, 4.45, 4.7, 4.95, 5.2, 5.45,
  5.7, 5.95, 6.2, 6.45, 6.7, 6.95, 7.2, 7.45,
];

const SPEED_COUNTER_TABLE = [
  4, 10, 18, 28, 40, 54, 70, 88,
  108, 130, 154, 180, 208, 238, 270, 9999,
];

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

const STAGE_TEMPLATES = [
  [
    '..12344321',
    '.123456543',
    '1234567654',
    'S123GG321S',
    '8765435678',
    '.876545678',
    '..8766678.',
    '...88..88.',
  ],
  [
    '11......11',
    '122....221',
    '1234..4321',
    '1235665321',
    'S234GG432S',
    '2345665432',
    '3456776543',
    '4567887654',
  ],
  [
    '...3333...',
    '..344443..',
    '.345GG543.',
    '3456666543',
    '4567777654',
    'S567888765',
    '.678888876',
    '..7899987.',
  ],
  [
    '1.2.3.4.5.',
    '.2.3.4.5.6',
    '3.4.5.6.7.',
    '.4.5.G.6.7',
    '5.6.G.G.7.',
    '.6.7.G.8.1',
    '7.8.1.2.3.',
    'S8.1.2.3.S',
  ],
  [
    '1111222211',
    '2222333322',
    '3333444433',
    '4444GG4444',
    '5555GG5555',
    '6666777766',
    '7777888877',
    '8888999988',
  ],
  [
    '..12SS21..',
    '.12344321.',
    '1235665321',
    '2345GG5432',
    '3456GG6543',
    '4567777654',
    '.567888765',
    '..678998..',
  ],
  [
    '1S1S1S1S1S',
    '2121212121',
    '3232323232',
    '434GG43434',
    '545GG54545',
    '6565656565',
    '7676767676',
    '8S8S8S8S8S',
  ],
  [
    '....11....',
    '...1221...',
    '..123321..',
    '.123GG321.',
    '1234GG4321',
    '.234666432',
    '..3455543.',
    '...46664..',
  ],
  [
    '8765434567',
    '7654323456',
    '6543212345',
    '5432GG2345',
    '4321GG1234',
    '3212343212',
    '2123454321',
    'S12345678S',
  ],
  [
    '1234567891',
    '2345678912',
    '3456789123',
    '4567GG1234',
    '5678GG2345',
    '6789123456',
    '7891234567',
    '8912345678',
  ],
  [
    'SS......SS',
    'S12344321S',
    '1234555432',
    '23456GG432',
    '34567GG543',
    '4567887654',
    '5678998765',
    'SS......SS',
  ],
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

let effects = {
  expand: false,
  catch: false,
  laser: false,
  breakTimer: 0,
};

const stageDefs = buildStageDefs();

highEl.textContent = highScore;
syncSettingsUI(settings);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function sanitizeSettings(next) {
  const lives = next.lives === '5' ? '5' : '3';
  const bonus = next.bonus === '20_only' ? '20_only' : '20_60';
  const difficulty = next.difficulty === 'hard' ? 'hard' : 'easy';
  const continueMode = next.continueMode === 'without' ? 'without' : 'with';
  return { lives, bonus, difficulty, continueMode };
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
  dipContinue.value = next.continueMode;
}

function applySettingsFromUI() {
  const next = sanitizeSettings({
    lives: dipLives.value,
    bonus: dipBonus.value,
    difficulty: dipDifficulty.value,
    continueMode: dipContinue.value,
  });
  settings = next;
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

function shiftRow(row, offset) {
  const chars = row.split('');
  const len = chars.length;
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    out[(i + offset + len) % len] = chars[i];
  }
  return out.join('');
}

function buildStageDefs() {
  const defs = [];
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const template = STAGE_TEMPLATES[i % STAGE_TEMPLATES.length];
    const shift = i % BRICK_COLS;
    const rows = template.map((r, rowIdx) => shiftRow(r, (shift + rowIdx) % BRICK_COLS));
    defs.push({ rows });
  }
  return defs;
}

function speedValues() {
  return settings.difficulty === 'hard' ? SPEED_VALUES_HARD : SPEED_VALUES_EASY;
}

function currentBallSpeed() {
  const table = speedValues();
  return table[clamp(speedIndex, 0, table.length - 1)];
}

function silverHitsForStage(stageNum) {
  return clamp(1 + Math.floor((stageNum - 1) / 8), 1, 6);
}

function capsuleCountForStage(stageNum) {
  return clamp(2 + Math.floor((stageNum - 1) / 5), 2, 8);
}

function chooseCapsule(rand) {
  const idx = Math.floor(rand() * CAPSULE_WEIGHTS.length);
  return CAPSULE_WEIGHTS[clamp(idx, 0, CAPSULE_WEIGHTS.length - 1)];
}

function assignStageCapsules(stageNum) {
  const rand = seededRandom(stageNum * 101 + 17);
  const candidates = bricks.filter((b) => b.type !== BrickType.GOLD);
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

function clearRoundObjects() {
  balls = [];
  bullets = [];
  capsules = [];
}

function resetBallsForServe() {
  clearRoundObjects();
  const b = makeBall(true);
  b.x = paddle.x + paddle.width / 2;
  b.y = PADDLE_Y - BALL_R - 2;
  balls.push(b);
}

function clearTransientEffectsOnLifeLoss() {
  effects = {
    expand: false,
    catch: false,
    laser: false,
    breakTimer: 0,
  };
  paddle.width = BASE_PADDLE_W;
}

function initStage() {
  bricks = [];
  const def = stageDefs[stage - 1];
  const silverHits = silverHitsForStage(stage);

  for (let r = 0; r < BRICK_ROWS; r++) {
    const row = def.rows[r] || '..........';
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
        points = SILVER_BASE_POINTS * silverHits;
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
  const speed = currentBallSpeed();

  targets.forEach((b, idx) => {
    const spread = (idx - (targets.length - 1) / 2) * 0.22;
    const angle = -Math.PI / 2 + spread;
    b.stuck = false;
    b.served = true;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
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
  statusEl.textContent = 'Press Space or click to launch.';
  render();
}

function continueGame() {
  if (state !== State.DEAD || settings.continueMode !== 'with') return;
  lives = 1;
  clearTransientEffectsOnLifeLoss();
  state = State.READY;
  initStage();
  statusEl.textContent = `Continue: Stage ${stage}. Launch when ready.`;
}

function nextStage() {
  if (stage >= TOTAL_STAGES) {
    state = State.WON;
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
  statusEl.textContent = `Stage ${stage}. Press Space or click to launch.`;
  render();
}

function awardScore(amount) {
  score += amount;

  if (settings.bonus === '20_60') {
    while (score >= nextBonusLifeScore) {
      lives += 1;
      nextBonusLifeScore += 60000;
      sfx.play(BANK_PADDLEROYALE, 'powerup');
    }
  } else if (settings.bonus === '20_only' && bonusClaimed === 0 && score >= 20000) {
    lives += 1;
    bonusClaimed = 1;
    sfx.play(BANK_PADDLEROYALE, 'powerup');
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
    sfx.play(BANK_PADDLEROYALE, 'lose');
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
  switch (type) {
    case CapsuleType.EXPAND:
      effects.expand = true;
      paddle.width = EXPANDED_PADDLE_W;
      paddle.x = clamp(paddle.x, 0, W - paddle.width);
      break;
    case CapsuleType.SLOW:
      speedIndex = Math.max(0, speedIndex - 2);
      speedCounter = 0;
      balls.forEach((b) => {
        if (!b.stuck) normalizeBallVelocity(b);
      });
      break;
    case CapsuleType.CATCH:
      effects.catch = true;
      break;
    case CapsuleType.DISRUPTION:
      createDisruptionBalls();
      break;
    case CapsuleType.LASER:
      effects.laser = true;
      effects.catch = false;
      break;
    case CapsuleType.BREAK:
      effects.breakTimer = 60 * 10;
      break;
    case CapsuleType.PLAYER:
      lives += 1;
      updateHud();
      break;
    default:
      break;
  }

  sfx.play(BANK_PADDLEROYALE, 'powerup');
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
}

function spawnCapsule(brick) {
  if (!brick.capsule) return;
  capsules.push({
    x: brick.x + brick.w / 2,
    y: brick.y + brick.h / 2,
    vy: settings.difficulty === 'hard' ? 2.5 : 2.1,
    type: brick.capsule,
  });
  brick.capsule = null;
}

function damageBrick(brick, sourceIsBall) {
  if (brick.type === BrickType.GOLD) {
    if (!effects.breakTimer || !sourceIsBall) return false;
    brick.hits = 0;
    awardScore(100);
    return true;
  }

  brick.hits -= 1;
  sfx.play(BANK_PADDLEROYALE, 'brickHit', { row: brick.row });

  if (brick.hits <= 0) {
    awardScore(brick.points);
    spawnCapsule(brick);
    return true;
  }

  return false;
}

function fireLaser() {
  if (!effects.laser || state !== State.PLAYING) return;
  if (paddle.laserCooldown > 0) return;

  bullets.push({ x: paddle.x + 10, y: PADDLE_Y - 2, vy: -BULLET_SPEED });
  bullets.push({ x: paddle.x + paddle.width - 10, y: PADDLE_Y - 2, vy: -BULLET_SPEED });
  paddle.laserCooldown = 16;
  sfx.play(BANK_PADDLEROYALE, 'paddleHit');
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

  if (effects.catch && !effects.laser) {
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    state = State.READY;
    statusEl.textContent = 'Caught. Press Space or click to relaunch.';
    sfx.play(BANK_PADDLEROYALE, 'paddleHit');
    return;
  }

  const speed = currentBallSpeed();
  const hitPos = (ball.x - paddle.x) / paddle.width;
  const angle = (-150 + hitPos * 120) * (Math.PI / 180);
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
      ball.x = paddle.x + paddle.width / 2;
      ball.y = PADDLE_Y - BALL_R - 2;
      keep.push(ball);
      continue;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

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
        bricks.splice(i, 1);
        removedBrick = true;
      }

      if (!effects.breakTimer || brick.type === BrickType.GOLD && !broke) {
        if (axis === 'x') ball.vx *= -1;
        else ball.vy *= -1;
      }

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
        if (broke) bricks.splice(i, 1);
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

function breakableBricksLeft() {
  return bricks.filter((b) => b.type !== BrickType.GOLD).length;
}

function tick() {
  if (state !== State.PLAYING && state !== State.READY) return;

  if (keys.arrowleft || keys.a) paddle.vx = -PADDLE_SPEED;
  else if (keys.arrowright || keys.d) paddle.vx = PADDLE_SPEED;
  else paddle.vx = 0;

  paddle.x += paddle.vx;
  paddle.x = clamp(paddle.x, 0, W - paddle.width);

  if (state === State.READY) {
    for (const b of balls) {
      if (b.stuck) {
        b.x = paddle.x + paddle.width / 2;
        b.y = PADDLE_Y - BALL_R - 2;
      }
    }
  }

  if (state !== State.PLAYING) return;

  updateBalls();
  updateBullets();
  updateCapsules();

  if (effects.breakTimer > 0) {
    effects.breakTimer -= 1;
  }

  if (balls.length === 0) {
    loseLife();
    return;
  }

  if (breakableBricksLeft() === 0) {
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
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  drawSpriteBricks(ctx, bricks, BRICK_COLORS);
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
    statusEl.textContent = 'Paused. Press P to resume.';
    pauseBtn.textContent = 'Resume';
    render();
  } else if (state === State.PAUSED) {
    state = balls.some((b) => !b.stuck) ? State.PLAYING : State.READY;
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

canvas.addEventListener('pointerdown', (ev) => {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }
  if (isSettingsOpen()) return;
  ev.preventDefault();
  movePaddleFromClientX(ev.clientX);
  if (state === State.READY || state === State.IDLE) {
    if (state === State.IDLE) startGame();
    launchStuckBalls();
    return;
  }
  if (state === State.PLAYING) fireLaser();
});

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

startGame();
render();
requestAnimationFrame(gameLoop);



