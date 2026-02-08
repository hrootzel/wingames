import { SfxEngine } from './sfx_engine.js';
import { BANK_SNAKE } from './sfx_bank_snake.js';
import { initGameShell } from './game-shell.js';

const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const lengthEl = document.getElementById('length');
const speedEl = document.getElementById('speed');
const highEl = document.getElementById('high');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.5 });
let audioUnlocked = false;

const CELL = 20;
const W = canvas.width / CELL;
const H = canvas.height / CELL;
const FIXED_DT = 1000 / 60;
const BASE_INTERVAL = 10; // frames per move at speed 1
const STORAGE_HIGH = 'snake.high';

const State = { IDLE: 0, PLAYING: 1, PAUSED: 2, DEAD: 3 };

let state = State.IDLE;
let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = null;
let score = 0;
let speed = 1;
let highScore = parseInt(localStorage.getItem(STORAGE_HIGH)) || 0;
let frameCount = 0;
let accum = 0;
let lastTime = 0;

highEl.textContent = highScore;

function init() {
  snake = [
    { x: Math.floor(W / 2), y: Math.floor(H / 2) },
    { x: Math.floor(W / 2) - 1, y: Math.floor(H / 2) },
    { x: Math.floor(W / 2) - 2, y: Math.floor(H / 2) },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  speed = 1;
  frameCount = 0;
  spawnFood();
  updateHud();
  render();
}

function spawnFood() {
  const free = [];
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (!snake.some(s => s.x === x && s.y === y)) {
        free.push({ x, y });
      }
    }
  }
  food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function moveInterval() {
  return Math.max(2, BASE_INTERVAL - speed + 1);
}

function tick() {
  if (state !== State.PLAYING) return;
  
  dir = nextDir;
  const head = snake[0];
  const nx = head.x + dir.x;
  const ny = head.y + dir.y;

  // Wall collision
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
    die();
    return;
  }

  // Self collision
  if (snake.some(s => s.x === nx && s.y === ny)) {
    die();
    return;
  }

  snake.unshift({ x: nx, y: ny });
  sfx.play(BANK_SNAKE, 'move');

  // Eat food
  if (food && nx === food.x && ny === food.y) {
    score += 10 * speed;
    sfx.play(BANK_SNAKE, 'eat');
    if (snake.length % 5 === 0 && speed < 10) {
      speed++;
      sfx.play(BANK_SNAKE, 'levelUp');
    }
    spawnFood();
  } else {
    snake.pop();
  }

  updateHud();
  render();
}

function die() {
  state = State.DEAD;
  sfx.play(BANK_SNAKE, 'die');
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE_HIGH, highScore);
    highEl.textContent = highScore;
  }
  statusEl.textContent = `Game Over! Score: ${score}. Press R or New Game.`;
  render();
}

function updateHud() {
  scoreEl.textContent = score;
  lengthEl.textContent = snake.length;
  speedEl.textContent = speed;
}

function render() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(canvas.width, y * CELL);
    ctx.stroke();
  }

  // Food
  if (food) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snake
  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#22c55e' : '#4ade80';
    ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
  });

  // Dead overlay
  if (state === State.DEAD) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  }

  // Paused overlay
  if (state === State.PAUSED) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
  }
}

function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;
  accum += dt;

  while (accum >= FIXED_DT) {
    accum -= FIXED_DT;
    if (state === State.PLAYING) {
      frameCount++;
      if (frameCount >= moveInterval()) {
        frameCount = 0;
        tick();
      }
    }
  }

  requestAnimationFrame(gameLoop);
}

function setDirection(x, y) {
  // Prevent 180 turn
  if (dir.x === -x && dir.y === -y) return;
  if (dir.x === x && dir.y === y) return;
  nextDir = { x, y };
}

function startGame() {
  if (state === State.PLAYING) return;
  init();
  state = State.PLAYING;
  statusEl.textContent = 'Playing...';
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

document.addEventListener('keydown', (e) => {
  if (!audioUnlocked) {
    sfx.unlock();
    audioUnlocked = true;
  }

  const key = e.key.toLowerCase();

  if (key === 'r') {
    startGame();
    return;
  }

  if (key === 'p') {
    togglePause();
    return;
  }

  if (state === State.IDLE || state === State.DEAD) {
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
      startGame();
    }
  }

  if (state !== State.PLAYING) return;

  switch (key) {
    case 'arrowup':
    case 'w':
      e.preventDefault();
      setDirection(0, -1);
      break;
    case 'arrowdown':
    case 's':
      e.preventDefault();
      setDirection(0, 1);
      break;
    case 'arrowleft':
    case 'a':
      e.preventDefault();
      setDirection(-1, 0);
      break;
    case 'arrowright':
    case 'd':
      e.preventDefault();
      setDirection(1, 0);
      break;
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

init();

initGameShell({
  shellEl: '.snake-board',
  surfaceEl: '#snake-surface',
  canvasEl: canvas,
  baseWidth: canvas.width,
  baseHeight: canvas.height,
  mode: 'fractional',
  fit: 'css'
});

render();
requestAnimationFrame(gameLoop);
