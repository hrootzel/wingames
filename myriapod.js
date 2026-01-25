import { SfxEngine } from './sfx_engine.js';
import { BANK_MYRIAPOD } from './sfx_bank_myriapod.js';

const canvas = document.getElementById('myriapod-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const livesEl = document.getElementById('lives');
const highEl = document.getElementById('high');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.5 });
let audioUnlocked = false;

const W = 240;
const H = 256;
const CELL = 8;
const COLS = W / CELL; // 30
const ROWS = H / CELL; // 32
const PLAYER_AREA = 8; // bottom 8 rows
const FIXED_DT = 1000 / 60;
const STORAGE_HIGH = 'myriapod.high';

const State = { IDLE: 0, PLAYING: 1, PAUSED: 2, DEAD: 3, WAVE_COMPLETE: 4 };

let state = State.IDLE;
let player = { x: 0, y: 0, speed: 3 };
let bullet = null;
let centipede = [];
let mushrooms = [];
let enemies = [];
let score = 0;
let wave = 1;
let lives = 3;
let highScore = parseInt(localStorage.getItem(STORAGE_HIGH)) || 0;
let keys = {};
let mouseX = W / 2;
let mouseY = H - CELL * 2;
let mouseDown = false;
let accum = 0;
let lastTime = 0;
let frameCount = 0;
let waveCompleteTimer = 0;

highEl.textContent = highScore;

// Sprite data (8x8 pixels, 1=color, 0=transparent)
const SPRITES = {
  player: [
    '00011000',
    '00111100',
    '01111110',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
  ],
  centipedeHead: [
    '00111100',
    '01111110',
    '11011011',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00000000',
  ],
  centipedeBody: [
    '00111100',
    '01111110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00000000',
  ],
  mushroom: [
    '00111100',
    '01111110',
    '11111111',
    '11111111',
    '00111100',
    '00111100',
    '00111100',
    '00011000',
  ],
  spider: [
    '10100101',
    '01011010',
    '00111100',
    '01111110',
    '01111110',
    '00111100',
    '01011010',
    '10100101',
  ],
  flea: [
    '00011000',
    '00111100',
    '01111110',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
    '00000000',
  ],
  scorpion: [
    '00011000',
    '00111100',
    '01111110',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '10000001',
  ],
};

function drawSprite(sprite, x, y, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (sprite[row][col] === '1') {
        ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}

function init() {
  player.x = W / 2;
  player.y = H - CELL * 2;
  bullet = null;
  mushrooms = [];
  centipede = [];
  enemies = [];
  frameCount = 0;
  
  // Create mushrooms
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * COLS) * CELL;
    const y = Math.floor(Math.random() * (ROWS - PLAYER_AREA - 2) + 2) * CELL;
    mushrooms.push({ x, y, hits: 0 });
  }
  
  spawnCentipede();
  updateHud();
  render();
}

function spawnCentipede() {
  centipede = [];
  const length = 12;
  const startX = 0;
  const startY = CELL;
  for (let i = 0; i < length; i++) {
    centipede.push({
      x: startX - i * CELL,
      y: startY,
      dx: 1,
      dy: 0,
      isHead: i === 0,
    });
  }
}

function startGame() {
  score = 0;
  wave = 1;
  lives = 3;
  state = State.PLAYING;
  init();
  statusEl.textContent = 'Playing...';
}

function updateHud() {
  scoreEl.textContent = score;
  waveEl.textContent = wave;
  livesEl.textContent = lives;
}

function tick() {
  if (state !== State.PLAYING) return;
  
  frameCount++;
  
  // Player movement
  player.x = Math.max(0, Math.min(W - CELL, mouseX - CELL / 2));
  player.y = Math.max(H - CELL * PLAYER_AREA, Math.min(H - CELL, mouseY - CELL / 2));
  
  // Auto-fire when mouse held
  if (mouseDown && frameCount % 10 === 0) {
    shoot();
  }
  
  // Bullet movement
  if (bullet) {
    bullet.y -= 4;
    if (bullet.y < 0) bullet = null;
  }
  
  // Centipede movement
  if (frameCount % (10 - Math.min(wave, 5)) === 0) {
    moveCentipede();
  }
  
  // Enemy spawning
  if (frameCount % 300 === 0 && Math.random() < 0.3) {
    spawnSpider();
  }
  if (frameCount % 400 === 0 && mushroomsInPlayerArea() < 5) {
    spawnFlea();
  }
  if (frameCount % 500 === 0 && Math.random() < 0.2) {
    spawnScorpion();
  }
  
  // Move enemies
  enemies.forEach(e => {
    if (e.type === 'spider') {
      e.x += e.dx * 2;
      e.y += e.dy;
      if (e.x < 0 || e.x > W - CELL) e.dx *= -1;
      if (e.y < H - CELL * PLAYER_AREA || e.y > H - CELL) e.dy *= -1;
      if (frameCount % 30 === 0) sfx.play(BANK_MYRIAPOD, 'spider');
      e.timer--;
    } else if (e.type === 'flea') {
      e.y += 2;
      if (Math.random() < 0.1) {
        mushrooms.push({ x: e.x, y: e.y, hits: 0 });
      }
      if (frameCount % 20 === 0) sfx.play(BANK_MYRIAPOD, 'flea');
    } else if (e.type === 'scorpion') {
      e.x += e.dx * 2;
      if (frameCount % 40 === 0) sfx.play(BANK_MYRIAPOD, 'scorpion');
    }
  });
  
  // Remove off-screen enemies or expired timers
  enemies = enemies.filter(e => {
    if (e.type === 'spider' && e.timer <= 0) return false;
    if (e.type === 'flea' && e.y > H) return false;
    if (e.type === 'scorpion' && (e.x < -CELL || e.x > W)) return false;
    return true;
  });
  
  checkCollisions();
  
  if (centipede.length === 0) {
    state = State.WAVE_COMPLETE;
    waveCompleteTimer = 120;
    sfx.play(BANK_MYRIAPOD, 'waveComplete');
  }
}

function moveCentipede() {
  for (let i = centipede.length - 1; i >= 0; i--) {
    const seg = centipede[i];
    
    if (i === 0 || seg.isHead) {
      const nextX = seg.x + seg.dx * CELL;
      const nextY = seg.y;
      
      // Check for edge or mushroom
      let shouldDrop = false;
      if (nextX < 0 || nextX >= W) {
        shouldDrop = true;
      } else if (mushrooms.some(m => m.x === nextX && m.y === nextY)) {
        shouldDrop = true;
      }
      
      if (shouldDrop) {
        seg.dx *= -1;
        seg.y += CELL;
        if (seg.y >= H - CELL * PLAYER_AREA) {
          // Reached player area - game over
          loseLife();
          return;
        }
      } else {
        seg.x = nextX;
      }
      
      if (frameCount % 20 === 0) {
        sfx.play(BANK_MYRIAPOD, 'centipedeMove');
      }
    } else {
      // Follow previous segment
      const prev = centipede[i - 1];
      seg.x = prev.x;
      seg.y = prev.y;
      seg.dx = prev.dx;
    }
  }
}

function spawnSpider() {
  const side = Math.random() < 0.5 ? 0 : 1;
  enemies.push({
    type: 'spider',
    x: side === 0 ? CELL : W - CELL * 2,
    y: H - CELL * 4,
    dx: side === 0 ? 1 : -1,
    dy: 1,
    timer: 300, // despawn after ~5 seconds
  });
}

function spawnFlea() {
  enemies.push({
    type: 'flea',
    x: Math.floor(Math.random() * COLS) * CELL,
    y: 0,
  });
}

function spawnScorpion() {
  const side = Math.random() < 0.5 ? -CELL : W;
  enemies.push({
    type: 'scorpion',
    x: side,
    y: Math.floor(Math.random() * (ROWS - PLAYER_AREA - 2) + 2) * CELL,
    dx: side < 0 ? 1 : -1,
  });
}

function mushroomsInPlayerArea() {
  return mushrooms.filter(m => m.y >= H - CELL * PLAYER_AREA).length;
}

function checkCollisions() {
  // Bullet vs centipede
  if (bullet) {
    for (let i = 0; i < centipede.length; i++) {
      const seg = centipede[i];
      if (Math.abs(bullet.x - seg.x) < CELL && Math.abs(bullet.y - seg.y) < CELL) {
        score += seg.isHead ? 100 : 10;
        sfx.play(BANK_MYRIAPOD, 'explosion');
        mushrooms.push({ x: seg.x, y: seg.y, hits: 0 });
        
        // Split centipede
        const newHead = centipede[i + 1];
        if (newHead) newHead.isHead = true;
        centipede.splice(i, 1);
        bullet = null;
        updateHud();
        break;
      }
    }
  }
  
  // Bullet vs mushrooms
  if (bullet) {
    for (let m of mushrooms) {
      if (Math.abs(bullet.x - m.x) < CELL && Math.abs(bullet.y - m.y) < CELL) {
        m.hits++;
        if (m.hits >= 4) {
          mushrooms = mushrooms.filter(mm => mm !== m);
          score += 1;
        }
        sfx.play(BANK_MYRIAPOD, 'explosion');
        bullet = null;
        updateHud();
        break;
      }
    }
  }
  
  // Bullet vs enemies
  if (bullet) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (Math.abs(bullet.x - e.x) < CELL && Math.abs(bullet.y - e.y) < CELL) {
        if (e.type === 'spider') score += 600;
        else if (e.type === 'flea') score += 200;
        else if (e.type === 'scorpion') score += 1000;
        sfx.play(BANK_MYRIAPOD, 'explosion');
        enemies.splice(i, 1);
        bullet = null;
        updateHud();
        break;
      }
    }
  }
  
  // Player vs centipede
  for (let seg of centipede) {
    if (Math.abs(player.x - seg.x) < CELL && Math.abs(player.y - seg.y) < CELL) {
      loseLife();
      return;
    }
  }
  
  // Player vs enemies
  for (let e of enemies) {
    if (Math.abs(player.x - e.x) < CELL && Math.abs(player.y - e.y) < CELL) {
      loseLife();
      return;
    }
  }
}

function loseLife() {
  lives--;
  livesEl.textContent = lives;
  sfx.play(BANK_MYRIAPOD, 'playerDeath');
  
  if (lives <= 0) {
    state = State.DEAD;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_HIGH, highScore);
      highEl.textContent = highScore;
    }
    statusEl.textContent = `Game Over! Score: ${score}. Press R or New Game.`;
  } else {
    player.x = W / 2;
    player.y = H - CELL * 2;
    bullet = null;
    statusEl.textContent = `${lives} lives left.`;
  }
}

function shoot() {
  if (!bullet && state === State.PLAYING) {
    bullet = { x: player.x + CELL / 2, y: player.y };
    sfx.play(BANK_MYRIAPOD, 'shoot');
  }
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  
  // Mushrooms
  mushrooms.forEach(m => {
    const color = ['#00ff00', '#88ff00', '#ffff00', '#ff8800'][m.hits];
    drawSprite(SPRITES.mushroom, m.x, m.y, color);
  });
  
  // Centipede
  centipede.forEach(seg => {
    const sprite = seg.isHead ? SPRITES.centipedeHead : SPRITES.centipedeBody;
    drawSprite(sprite, seg.x, seg.y, '#ff00ff');
  });
  
  // Enemies
  enemies.forEach(e => {
    if (e.type === 'spider') drawSprite(SPRITES.spider, e.x, e.y, '#ff0000');
    else if (e.type === 'flea') drawSprite(SPRITES.flea, e.x, e.y, '#00ffff');
    else if (e.type === 'scorpion') drawSprite(SPRITES.scorpion, e.x, e.y, '#ffff00');
  });
  
  // Bullet
  if (bullet) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(bullet.x, bullet.y, 2, 4);
  }
  
  // Player
  drawSprite(SPRITES.player, player.x, player.y, '#00ff00');
  
  // Player area line
  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(0, H - CELL * PLAYER_AREA);
  ctx.lineTo(W, H - CELL * PLAYER_AREA);
  ctx.stroke();
  
  // Overlays
  if (state === State.PAUSED) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
  }
  
  if (state === State.DEAD) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
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
    
    if (state === State.WAVE_COMPLETE) {
      waveCompleteTimer--;
      if (waveCompleteTimer <= 0) {
        wave++;
        init();
        state = State.PLAYING;
        statusEl.textContent = `Wave ${wave}!`;
      }
    } else {
      tick();
    }
  }
  
  render();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (W / rect.width);
  mouseY = (e.clientY - rect.top) * (H / rect.height);
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  if (state === State.IDLE) startGame();
});

canvas.addEventListener('mousedown', () => {
  if (!audioUnlocked) { sfx.unlock(); audioUnlocked = true; }
  mouseDown = true;
  shoot();
});

canvas.addEventListener('mouseup', () => {
  mouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
  mouseDown = false;
});

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') startGame();
  if (e.key.toLowerCase() === 'p') togglePause();
  if (e.key === ' ') { e.preventDefault(); shoot(); }
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
render();
requestAnimationFrame(gameLoop);
