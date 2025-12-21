import { SfxEngine } from './sfx_engine.js';
import { BANK_SUPERBUSTER } from './sfx_bank_super_buster.js';

const WORLD_W = 640;
const WORLD_H = 360;
const FLOOR_Y = WORLD_H - 24;

const GRAVITY = 1800;
const RADIUS = [10, 16, 24, 34];
const JUMP_SPEED = [520, 650, 780, 920];
const VX_MAG = [210, 190, 170, 150];
const SCORE_ADD = [120, 80, 50, 30];
const STARTING_LIVES = 3;
const MOVE_SFX_INTERVAL = 0.09;

const GameState = {
  LEVEL_START: 'LEVEL_START',
  PLAYING: 'PLAYING',
  PLAYER_HIT: 'PLAYER_HIT',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
};

const LEVELS = [
  {
    name: 'Level 1',
    balls: [
      { size: 3, x: 160, y: 120, dir: 1 },
    ],
  },
  {
    name: 'Level 2',
    balls: [
      { size: 3, x: 140, y: 140, dir: 1 },
      { size: 2, x: 420, y: 110, dir: -1 },
    ],
  },
  {
    name: 'Level 3',
    balls: [
      { size: 3, x: 200, y: 90, dir: 1 },
      { size: 3, x: 440, y: 90, dir: -1 },
    ],
  },
  {
    name: 'Level 4',
    balls: [
      { size: 2, x: 140, y: 80, dir: 1 },
      { size: 2, x: 320, y: 120, dir: -1 },
      { size: 2, x: 500, y: 80, dir: 1 },
    ],
  },
];

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
const newBtn = document.getElementById('new-game');

const sfx = new SfxEngine({ master: 0.6 });
let audioUnlocked = false;

const input = {
  left: false,
  right: false,
  firePressed: false,
};

const game = {
  player: {
    x: WORLD_W * 0.5,
    w: 22,
    h: 28,
    speed: 220,
    hitR: 12,
  },
  harpoon: {
    active: false,
    x: 0,
    yBottom: 0,
    yTop: 0,
    extendSpeed: 900,
    stickTime: 0.15,
    state: 'extend',
    timer: 0,
  },
  balls: [],
  levelIndex: 0,
  score: 0,
  lives: STARTING_LIVES,
  moveSfxTimer: MOVE_SFX_INTERVAL,
  state: GameState.LEVEL_START,
  stateTimer: 0,
  status: 'Ready.',
};

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function makeBall(spec) {
  const size = spec.size;
  const r = RADIUS[size];
  const x = clamp(spec.x, r, WORLD_W - r);
  const y = clamp(spec.y, r, FLOOR_Y - r);
  const dir = spec.dir >= 0 ? 1 : -1;
  return {
    size,
    x,
    y,
    vx: VX_MAG[size] * dir,
    vy: -JUMP_SPEED[size] * 0.8,
  };
}

function loadLevel() {
  const level = LEVELS[game.levelIndex];
  game.balls = level.balls.map((spec) => makeBall(spec));
  game.harpoon.active = false;
  game.player.x = WORLD_W * 0.5;
  game.state = GameState.PLAYING;
  game.stateTimer = 0;
  game.status = level.name;
}

function newGame() {
  game.levelIndex = 0;
  game.score = 0;
  game.lives = STARTING_LIVES;
  game.balls = [];
  game.harpoon.active = false;
  game.moveSfxTimer = MOVE_SFX_INTERVAL;
  game.state = GameState.LEVEL_START;
  game.stateTimer = 0;
  game.status = 'Ready.';
}

function fireHarpoon() {
  const h = game.harpoon;
  h.active = true;
  h.x = game.player.x;
  h.yBottom = FLOOR_Y - game.player.h;
  h.yTop = h.yBottom;
  h.state = 'extend';
  h.timer = 0;
  sfx.play(BANK_SUPERBUSTER, 'shoot');
}

function updateHarpoon(dt) {
  const h = game.harpoon;
  if (!h.active) return;
  if (h.state === 'extend') {
    h.yTop -= h.extendSpeed * dt;
    if (h.yTop <= 0) {
      h.yTop = 0;
      h.state = 'stick';
      h.timer = h.stickTime;
      sfx.play(BANK_SUPERBUSTER, 'harpoonTop');
    }
  } else if (h.state === 'stick') {
    h.timer -= dt;
    if (h.timer <= 0) {
      h.active = false;
    }
  }
}

function updateBall(ball, dt) {
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const r = RADIUS[ball.size];
  if (ball.y + r > FLOOR_Y) {
    ball.y = FLOOR_Y - r;
    ball.vy = -JUMP_SPEED[ball.size];
  }
  if (ball.y - r < 0) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy);
  }
  if (ball.x - r < 0) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + r > WORLD_W) {
    ball.x = WORLD_W - r;
    ball.vx = -Math.abs(ball.vx);
  }
}

function harpoonHitsBall(harpoon, ball) {
  if (!harpoon.active) return false;
  const r = RADIUS[ball.size];
  const dx = Math.abs(ball.x - harpoon.x);
  if (dx > r) return false;
  const yTop = Math.min(harpoon.yTop, harpoon.yBottom);
  const yBottom = Math.max(harpoon.yTop, harpoon.yBottom);
  return ball.y + r >= yTop && ball.y - r <= yBottom;
}

function splitBall(index) {
  const ball = game.balls[index];
  const size = ball.size;
  game.balls.splice(index, 1);
  game.score += SCORE_ADD[size] || 10;
  const maxSize = RADIUS.length - 1;
  sfx.play(BANK_SUPERBUSTER, 'hit', { sizeIndex: size, maxSize });
  if (size === 0) {
    sfx.play(BANK_SUPERBUSTER, 'pop');
    return;
  }

  const child = size - 1;
  const r = RADIUS[child];
  const baseY = Math.min(ball.y, FLOOR_Y - r);
  const vy = -JUMP_SPEED[child] * 0.85;
  const vx = VX_MAG[child];
  sfx.play(BANK_SUPERBUSTER, 'split', { sizeIndex: size, childSizeIndex: child, maxSize });
  game.balls.push({
    size: child,
    x: ball.x - r * 0.25,
    y: baseY,
    vx: -vx,
    vy,
  });
  game.balls.push({
    size: child,
    x: ball.x + r * 0.25,
    y: baseY,
    vx,
    vy,
  });
}

function playerHitBall(ball) {
  const px = game.player.x;
  const py = FLOOR_Y - game.player.h * 0.55;
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
  game.harpoon.active = false;
}

function setLevelClear() {
  game.state = GameState.LEVEL_CLEAR;
  game.stateTimer = 0.8;
  game.status = 'Level clear!';
  game.harpoon.active = false;
  sfx.play(BANK_SUPERBUSTER, 'levelClear', { level: game.levelIndex + 1 });
}

function setGameOver(message, playSfx = true) {
  game.state = GameState.GAME_OVER;
  game.status = message || 'Game over. Press R to restart.';
  game.harpoon.active = false;
  if (playSfx) {
    sfx.play(BANK_SUPERBUSTER, 'gameOver');
  }
}

function handlePlayerHit() {
  game.lives = Math.max(0, game.lives - 1);
  sfx.play(BANK_SUPERBUSTER, 'playerHit');
  if (game.lives <= 0) {
    setGameOver('Game over. Press R to restart.');
  } else {
    setPlayerHit();
  }
}

function updatePlaying(dt) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    game.player.x += dir * game.player.speed * dt;
    game.player.x = clamp(game.player.x, game.player.w / 2, WORLD_W - game.player.w / 2);
    game.moveSfxTimer += dt;
    while (game.moveSfxTimer >= MOVE_SFX_INTERVAL) {
      sfx.play(BANK_SUPERBUSTER, 'move');
      game.moveSfxTimer -= MOVE_SFX_INTERVAL;
    }
  } else {
    game.moveSfxTimer = MOVE_SFX_INTERVAL;
  }

  if (input.firePressed && !game.harpoon.active) {
    fireHarpoon();
  }
  input.firePressed = false;

  updateHarpoon(dt);

  for (const ball of game.balls) {
    updateBall(ball, dt);
  }

  if (game.harpoon.active) {
    for (let i = 0; i < game.balls.length; i++) {
      if (harpoonHitsBall(game.harpoon, game.balls[i])) {
        splitBall(i);
        game.harpoon.active = false;
        break;
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
    setLevelClear();
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

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(1, '#0b1120');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = '#0b1d2a';
  ctx.fillRect(0, FLOOR_Y, WORLD_W, WORLD_H - FLOOR_Y);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 0.5);
  ctx.lineTo(WORLD_W, FLOOR_Y + 0.5);
  ctx.stroke();
}

function drawHarpoon() {
  const h = game.harpoon;
  if (!h.active) return;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(h.x, h.yBottom);
  ctx.lineTo(h.x, h.yTop);
  ctx.stroke();
}

function drawBall(ball) {
  const r = RADIUS[ball.size];
  const palette = BALL_COLORS[ball.size % BALL_COLORS.length];
  const grad = ctx.createRadialGradient(
    ball.x - r * 0.35,
    ball.y - r * 0.35,
    r * 0.15,
    ball.x,
    ball.y,
    r
  );
  grad.addColorStop(0, palette.highlight);
  grad.addColorStop(0.55, palette.base);
  grad.addColorStop(1, palette.shadow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
}

function drawPlayer() {
  const p = game.player;
  const apexX = p.x;
  const apexY = FLOOR_Y - p.h;
  const leftX = p.x - p.w / 2;
  const rightX = p.x + p.w / 2;
  const baseY = FLOOR_Y;

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(rightX, baseY);
  ctx.lineTo(leftX, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function render() {
  drawBackground();
  drawHarpoon();
  for (const ball of game.balls) {
    drawBall(ball);
  }
  drawPlayer();
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  levelEl.textContent = (game.levelIndex + 1).toString();
  livesEl.textContent = game.lives.toString();
  statusEl.textContent = game.status;
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
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    input.left = true;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    input.right = true;
    ev.preventDefault();
  }
  if (isFireKey(ev)) {
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

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
document.addEventListener('pointerdown', unlockAudio, { once: true });

newGame();
loop();
