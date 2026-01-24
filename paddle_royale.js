import { SfxEngine } from './sfx_engine.js';
import { BANK_PADDLEROYALE } from './sfx_bank_paddle_royale.js';

const canvas = document.getElementById('paddle-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const highEl = document.getElementById('high');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.5 });
let audioUnlocked = false;

const W = canvas.width;
const H = canvas.height;
const FIXED_DT = 1000 / 60;
const PADDLE_W = 80;
const PADDLE_H = 12;
const PADDLE_Y = H - 40;
const PADDLE_SPEED = 6;
const BALL_R = 6;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const BRICK_W = W / BRICK_COLS;
const BRICK_H = 20;
const BRICK_OFFSET_Y = 60;
const STORAGE_HIGH = 'paddle_royale.high';

const State = { IDLE: 0, READY: 1, PLAYING: 2, PAUSED: 3, DEAD: 4, LEVEL_COMPLETE: 5 };

const BRICK_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'];

let state = State.IDLE;
let paddle = { x: W / 2 - PADDLE_W / 2, vx: 0 };
let ball = { x: 0, y: 0, vx: 0, vy: 0, stuck: true };
let bricks = [];
let score = 0;
let level = 1;
let lives = 3;
let highScore = parseInt(localStorage.getItem(STORAGE_HIGH)) || 0;
let keys = {};
let accum = 0;
let lastTime = 0;
let levelCompleteTimer = 0;

highEl.textContent = highScore;

function initLevel() {
  bricks = [];
  const rowsForLevel = Math.min(BRICK_ROWS, 3 + level);
  for (let r = 0; r < rowsForLevel; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const hits = Math.min(3, 1 + Math.floor(level / 3));
      bricks.push({
        x: c * BRICK_W,
        y: BRICK_OFFSET_Y + r * BRICK_H,
        w: BRICK_W,
        h: BRICK_H,
        hits,
        maxHits: hits,
        row: r,
      });
    }
  }
  resetBall();
  updateHud();
}

function resetBall() {
  paddle.x = W / 2 - PADDLE_W / 2;
  paddle.vx = 0;
  ball.x = paddle.x + PADDLE_W / 2;
  ball.y = PADDLE_Y - BALL_R - 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.stuck = true;
}

function launchBall() {
  if (!ball.stuck) return;
  ball.stuck = false;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  const speed = 5 + level * 0.3;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  state = State.PLAYING;
  statusEl.textContent = 'Playing...';
}

function startGame() {
  score = 0;
  level = 1;
  lives = 3;
  state = State.READY;
  initLevel();
  statusEl.textContent = 'Click or press Space to launch.';
  render();
}

function nextLevel() {
  level++;
  state = State.READY;
  initLevel();
  statusEl.textContent = `Level ${level}! Click or press Space to launch.`;
  render();
}

function loseLife() {
  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) {
    state = State.DEAD;
    sfx.play(BANK_PADDLEROYALE, 'gameOver');
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_HIGH, highScore);
      highEl.textContent = highScore;
    }
    statusEl.textContent = `Game Over! Score: ${score}. Press R or New Game.`;
  } else {
    state = State.READY;
    sfx.play(BANK_PADDLEROYALE, 'lose');
    resetBall();
    statusEl.textContent = `${lives} lives left. Click or press Space to launch.`;
  }
}

function updateHud() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  livesEl.textContent = lives;
}

function tick() {
  if (state !== State.PLAYING) return;

  // Paddle movement
  if (keys['arrowleft'] || keys['a']) paddle.vx = -PADDLE_SPEED;
  else if (keys['arrowright'] || keys['d']) paddle.vx = PADDLE_SPEED;
  else paddle.vx = 0;

  paddle.x += paddle.vx;
  paddle.x = Math.max(0, Math.min(W - PADDLE_W, paddle.x));

  // Ball stuck to paddle
  if (ball.stuck) {
    ball.x = paddle.x + PADDLE_W / 2;
    ball.y = PADDLE_Y - BALL_R - 2;
    return;
  }

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collisions
  if (ball.x - BALL_R <= 0 || ball.x + BALL_R >= W) {
    ball.vx *= -1;
    ball.x = Math.max(BALL_R, Math.min(W - BALL_R, ball.x));
    sfx.play(BANK_PADDLEROYALE, 'wallHit');
  }
  if (ball.y - BALL_R <= 0) {
    ball.vy *= -1;
    ball.y = BALL_R;
    sfx.play(BANK_PADDLEROYALE, 'wallHit');
  }

  // Paddle collision
  if (ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R < PADDLE_Y + PADDLE_H &&
      ball.x >= paddle.x && ball.x <= paddle.x + PADDLE_W) {
    ball.vy = -Math.abs(ball.vy);
    ball.y = PADDLE_Y - BALL_R;
    // Add spin based on paddle hit position
    const hitPos = (ball.x - paddle.x) / PADDLE_W - 0.5;
    ball.vx += hitPos * 3;
    sfx.play(BANK_PADDLEROYALE, 'paddleHit');
  }

  // Bottom death
  if (ball.y - BALL_R > H) {
    loseLife();
    return;
  }

  // Brick collisions
  for (let i = bricks.length - 1; i >= 0; i--) {
    const brick = bricks[i];
    if (ball.x + BALL_R > brick.x && ball.x - BALL_R < brick.x + brick.w &&
        ball.y + BALL_R > brick.y && ball.y - BALL_R < brick.y + brick.h) {
      
      // Determine collision side
      const overlapLeft = ball.x + BALL_R - brick.x;
      const overlapRight = brick.x + brick.w - (ball.x - BALL_R);
      const overlapTop = ball.y + BALL_R - brick.y;
      const overlapBottom = brick.y + brick.h - (ball.y - BALL_R);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }

      brick.hits--;
      score += 10 * level;
      sfx.play(BANK_PADDLEROYALE, 'brickHit', { row: brick.row });

      if (brick.hits <= 0) {
        bricks.splice(i, 1);
        score += 50 * level;
      }

      updateHud();
      break;
    }
  }

  // Level complete
  if (bricks.length === 0) {
    state = State.LEVEL_COMPLETE;
    levelCompleteTimer = 120;
    sfx.play(BANK_PADDLEROYALE, 'levelComplete');
    statusEl.textContent = `Level ${level} complete!`;
  }
}

function render() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Bricks
  bricks.forEach(brick => {
    const colorIdx = Math.min(brick.row, BRICK_COLORS.length - 1);
    const alpha = brick.hits / brick.maxHits;
    ctx.fillStyle = BRICK_COLORS[colorIdx];
    ctx.globalAlpha = 0.3 + alpha * 0.7;
    ctx.fillRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2);
    ctx.globalAlpha = 1;
    
    // Hit indicator
    if (brick.maxHits > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(brick.hits, brick.x + brick.w / 2, brick.y + brick.h / 2 + 4);
    }
  });

  // Paddle
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(paddle.x, PADDLE_Y, PADDLE_W, PADDLE_H);

  // Ball
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // Overlays
  if (state === State.PAUSED) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
  }

  if (state === State.DEAD) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2);
  }
}

function togglePause() {
  if (state === State.PLAYING) {
    state = State.PAUSED;
    statusEl.textContent = 'Paused. Press P to resume.';
    pauseBtn.textContent = 'Resume';
    render();
  } else if (state === State.PAUSED) {
    state = State.PLAYING;
    statusEl.textContent = 'Playing...';
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
      levelCompleteTimer--;
      if (levelCompleteTimer <= 0) {
        nextLevel();
      }
    } else {
      tick();
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === 'r') {
    startGame();
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
      launchBall();
    }
  }

  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', ' '].includes(key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('click', () => {
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  if (state === State.READY || state === State.IDLE) {
    if (state === State.IDLE) startGame();
    launchBall();
  }
});

newBtn.addEventListener('click', () => {
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  startGame();
});

pauseBtn.addEventListener('click', () => {
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  togglePause();
});

startGame();
render();
requestAnimationFrame(gameLoop);
