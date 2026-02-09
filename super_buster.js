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
  collideBallWithSolid,
  harpoonHitsBall,
  updatePlayerMovement,
} from './super_buster_engine.mjs';

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

const sfx = new SfxEngine({ master: 0.6 });
let audioUnlocked = false;

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
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
  geometry: { solids: [], ladders: [] },
  levelIndex: 0,
  levelTimeLeft: 0,
  score: 0,
  lives: STARTING_LIVES,
  moveSfxTimer: MOVE_SFX_INTERVAL,
  state: GameState.LEVEL_START,
  stateTimer: 0,
  status: 'Ready.',
};

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
  const level = LEVELS[game.levelIndex];
  game.balls = level.balls.map((spec) => makeBall(spec, {
    radius: RADIUS,
    vxMag: VX_MAG,
    jumpSpeed: JUMP_SPEED,
    worldW: WORLD_W,
    floorY: FLOOR_Y,
  }));
  game.geometry = level.geometry || { solids: [], ladders: [] };
  game.levelTimeLeft = Math.max(1, Number(level.timeLimitSec) || 60);
  game.harpoon.active = false;
  game.player.x = WORLD_W * 0.5;
  game.player.y = FLOOR_Y;
  game.player.onLadder = false;
  game.player.ladderIndex = -1;
  game.state = GameState.PLAYING;
  game.stateTimer = 0;
  game.status = level.name;
}

function newGame() {
  game.levelIndex = 0;
  game.score = 0;
  game.lives = STARTING_LIVES;
  game.balls = [];
  game.geometry = { solids: [], ladders: [] };
  game.levelTimeLeft = 0;
  game.harpoon.active = false;
  game.player.y = FLOOR_Y;
  game.player.onLadder = false;
  game.player.ladderIndex = -1;
  game.moveSfxTimer = MOVE_SFX_INTERVAL;
  game.state = GameState.LEVEL_START;
  game.stateTimer = 0;
  game.status = 'Ready.';
}

function fireHarpoon() {
  const h = game.harpoon;
  h.active = true;
  h.x = game.player.x;
  h.yBottom = game.player.y - game.player.h;
  h.yTop = h.yBottom;
  h.state = 'extend';
  h.timer = 0;
  sfx.play(BANK_SUPERBUSTER, 'shoot');
}

function updateHarpoon(dt) {
  const result = advanceHarpoon(game.harpoon, dt, game.geometry.solids, 0);
  if (result.stuck) {
    sfx.play(BANK_SUPERBUSTER, 'harpoonTop');
  }
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
  game.levelTimeLeft = Math.max(0, game.levelTimeLeft - dt);
  if (game.levelTimeLeft <= 0) {
    game.status = 'Time up!';
    handlePlayerHit();
    return;
  }

  const moveState = updatePlayerMovement(game.player, input, dt, {
    floorY: FLOOR_Y,
    worldW: WORLD_W,
    moveSpeed: game.player.speed,
    climbSpeed: game.player.climbSpeed,
    ladders: game.geometry.ladders,
  });
  if (moveState.movedHorizontally) {
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
    updateBall(ball, dt, {
      gravity: GRAVITY,
      radius: RADIUS,
      jumpSpeed: JUMP_SPEED,
      worldW: WORLD_W,
      floorY: FLOOR_Y,
    });
    for (const rect of game.geometry.solids) {
      collideBallWithSolid(ball, rect, RADIUS);
    }
  }

  if (game.harpoon.active) {
    for (let i = 0; i < game.balls.length; i++) {
      if (harpoonHitsBall(game.harpoon, game.balls[i], RADIUS)) {
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

function drawGeometry(ctx2d, geometry) {
  const solids = geometry?.solids || [];
  if (solids.length) {
    ctx2d.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx2d.lineWidth = 1;
    for (const rect of solids) {
      ctx2d.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx2d.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
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
  drawBackground(ctx, WORLD_W, WORLD_H, FLOOR_Y);
  drawGeometry(ctx, game.geometry);
  drawHarpoon(ctx, game.harpoon);
  for (const ball of game.balls) {
    drawBall(ctx, ball, RADIUS, BALL_COLORS);
  }
  drawPlayer(ctx, game.player, FLOOR_Y);
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  levelEl.textContent = (game.levelIndex + 1).toString();
  livesEl.textContent = game.lives.toString();
  if (timeEl) {
    timeEl.textContent = game.levelTimeLeft.toFixed(1);
  }
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
  if (key === 'arrowup' || key === 'w') {
    input.up = true;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    input.down = true;
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
  if (key === 'arrowup' || key === 'w') {
    input.up = false;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    input.down = false;
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
        player: clonePlain(game.player),
        harpoon: clonePlain(game.harpoon),
        balls: clonePlain(game.balls),
        geometry: clonePlain(game.geometry),
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
  };
}

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
document.addEventListener('pointerdown', unlockAudio, { once: true });

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
  await tryLoadExternalLevelPack();
  newGame();
  loop();
}

start();
