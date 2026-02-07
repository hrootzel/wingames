const COLS = 16;
const ROWS = 10;
const PIECE_SIZE = 2;
const SPAWN_X = 7;
const SPAWN_Y = ROWS;
const FIXED_DT = 1000 / 60;
const SOFT_DROP_MULTIPLIER = 8;
const SPAWN_DELAY_MS = 1300;
const DAS_MS = 150;
const ARR_MS = 60;
const LIGHT = 0;
const DARK = 1;

const STORAGE = {
  mode: 'prismpulse.mode',
  timeLimit: 'prismpulse.timeLimit',
  layout: 'prismpulse.layout',
  hiEndless: 'prismpulse.hi.endless',
  hiTimePrefix: 'prismpulse.hi.time.',
};

const MODES = {
  ENDLESS: 'endless',
  TIME: 'time',
};

const TIME_LIMITS = [60, 180, 300, 600];

const SKINS = [
  { name: 'Pulse', sweep: 6500, bgTop: '#11203a', bgBottom: '#060c19', line: '#60a5fa', light: '#bae6fd', dark: '#1d4ed8' },
  { name: 'Volt', sweep: 4500, bgTop: '#1a1f3f', bgBottom: '#0a0f24', line: '#a78bfa', light: '#ddd6fe', dark: '#6d28d9' },
  { name: 'Solar', sweep: 3000, bgTop: '#2d1d10', bgBottom: '#150d05', line: '#f59e0b', light: '#fde68a', dark: '#b45309' },
  { name: 'Neon', sweep: 1800, bgTop: '#0d2b2c', bgBottom: '#041516', line: '#5eead4', light: '#99f6e4', dark: '#0f766e' },
];

const canvas = document.getElementById('pulse-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');
const skinEl = document.getElementById('skin');
const modeLabelEl = document.getElementById('mode-label');
const timeLabelEl = document.getElementById('time-label');
const queuePreviewEl = document.getElementById('queue-preview');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const modeSelect = document.getElementById('mode-select');
const timeLimitSelect = document.getElementById('time-limit-select');
const layoutSelect = document.getElementById('layout-select');

const view = {
  boardX: 0,
  boardY: 0,
  boardW: 0,
  boardH: 0,
  cell: 24,
};

const game = makeGameState();

function makeGameState() {
  return {
    rng: makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0),
    grid: makeGrid(),
    active: null,
    queue: [],
    input: makeInput(),
    score: 0,
    highScore: 0,
    mode: MODES.ENDLESS,
    timeLimitSec: 180,
    timeRemainingMs: 0,
    paused: false,
    gameOver: false,
    level: 1,
    squaresClearedTotal: 0,
    squaresTowardNextLevel: 0,
    timelineX: -1,
    passAnchors: new Set(),
    skinIndex: 0,
    sweepPeriodMs: SKINS[0].sweep,
    skinFlashMs: 0,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    layout: 'horizontal',
    lastTime: performance.now(),
  };
}

function makeInput() {
  return {
    held: { left: false, right: false, down: false },
    pressed: { rotateCW: false, rotateCCW: false },
    repeat: { left: -DAS_MS, right: -DAS_MS },
    clearPressed() {
      this.pressed.rotateCW = false;
      this.pressed.rotateCCW = false;
    },
  };
}

function makeGrid() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

function makeRng(seed) {
  let t = seed >>> 0;
  return {
    next() {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * max);
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadSettings() {
  const mode = localStorage.getItem(STORAGE.mode);
  const timeLimit = Number(localStorage.getItem(STORAGE.timeLimit));
  const layout = localStorage.getItem(STORAGE.layout);
  game.mode = mode === MODES.TIME ? MODES.TIME : MODES.ENDLESS;
  game.timeLimitSec = TIME_LIMITS.includes(timeLimit) ? timeLimit : 180;
  game.layout = layout === 'vertical' ? 'vertical' : 'horizontal';
}

function saveSettings() {
  localStorage.setItem(STORAGE.mode, game.mode);
  localStorage.setItem(STORAGE.timeLimit, String(game.timeLimitSec));
  localStorage.setItem(STORAGE.layout, game.layout);
}

function highScoreKey() {
  if (game.mode === MODES.ENDLESS) return STORAGE.hiEndless;
  return `${STORAGE.hiTimePrefix}${game.timeLimitSec}`;
}

function loadHighScore() {
  const score = Number(localStorage.getItem(highScoreKey()) ?? 0);
  game.highScore = Number.isFinite(score) ? Math.max(0, score) : 0;
}

function storeHighScoreIfNeeded() {
  if (game.score <= game.highScore) return;
  game.highScore = game.score;
  localStorage.setItem(highScoreKey(), String(game.highScore));
}

function levelThreshold(level) {
  return 24 + level * 6;
}

function baseFallIntervalMs() {
  return clamp(650 - game.level * 12, 120, 650);
}

function updateThemeVars() {
  const skin = SKINS[game.skinIndex % SKINS.length];
  document.body.style.setProperty('--pp-bg-top', skin.bgTop);
  document.body.style.setProperty('--pp-bg-bottom', skin.bgBottom);
  document.body.style.setProperty('--pp-line', skin.line);
  document.body.style.setProperty('--pp-light', skin.light);
  document.body.style.setProperty('--pp-dark', skin.dark);
  document.body.style.setProperty('--pulse-glow', `${skin.line}66`);
}

function applyLayoutClass() {
  document.body.classList.remove('layout-horizontal', 'layout-vertical');
  document.body.classList.add(game.layout === 'vertical' ? 'layout-vertical' : 'layout-horizontal');
}

function syncSettingsUI() {
  modeSelect.value = game.mode;
  timeLimitSelect.value = String(game.timeLimitSec);
  layoutSelect.value = game.layout;
}

function isSettingsOpen() {
  return !settingsModal.classList.contains('hidden');
}

function openSettings() {
  syncSettingsUI();
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

function buildQueuePreview() {
  queuePreviewEl.textContent = '';
  for (let i = 0; i < 3; i++) {
    const mask = game.queue[i] ?? 0;
    const pieceEl = document.createElement('div');
    pieceEl.className = 'preview-piece';
    for (let bit = 0; bit < 4; bit++) {
      const cell = document.createElement('div');
      const dark = ((mask >> bit) & 1) === 1;
      cell.className = `preview-cell ${dark ? 'dark' : 'light'}`;
      pieceEl.appendChild(cell);
    }
    queuePreviewEl.appendChild(pieceEl);
  }
}

function generateMask() {
  let mask = 0;
  for (let bit = 0; bit < 4; bit++) {
    if (game.rng.int(2) === 1) {
      mask |= 1 << bit;
    }
  }
  return mask;
}

function queuePop() {
  const next = game.queue.shift();
  game.queue.push(generateMask());
  buildQueuePreview();
  return next;
}

function maskToCells(mask, originX, originY) {
  const cells = [];
  for (let ry = 0; ry < PIECE_SIZE; ry++) {
    for (let rx = 0; rx < PIECE_SIZE; rx++) {
      const bit = ry * PIECE_SIZE + rx;
      const color = ((mask >> bit) & 1) === 1 ? DARK : LIGHT;
      cells.push({ x: originX + rx, y: originY + ry, color });
    }
  }
  return cells;
}

function spawnPiece() {
  const mask = queuePop();
  const cells = maskToCells(mask, SPAWN_X, SPAWN_Y);
  for (const cell of cells) {
    if (cell.y < ROWS && game.grid[cell.y][cell.x]) {
      endGame('Top-out! Press R to restart.');
      return;
    }
  }
  game.active = {
    cells,
    spawnDelayMs: SPAWN_DELAY_MS,
    fallMs: 0,
  };
}

function isInside(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function canShiftActive(dx) {
  if (!game.active) return false;
  for (const block of game.active.cells) {
    const nx = block.x + dx;
    if (nx < 0 || nx >= COLS) return false;
    if (block.y >= 0 && block.y < ROWS && game.grid[block.y][nx]) return false;
  }
  return true;
}

function moveActive(dx) {
  if (!game.active || !canShiftActive(dx)) return false;
  for (const block of game.active.cells) {
    block.x += dx;
  }
  return true;
}

function stepActiveFall() {
  if (!game.active) return false;
  const blocks = [...game.active.cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const canMove = new Map();
  const indexByCoord = new Map();
  blocks.forEach((b, i) => indexByCoord.set(`${b.x},${b.y}`, i));

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const by = block.y - 1;
    if (by < 0) {
      canMove.set(i, false);
      continue;
    }
    if (isInside(block.x, by) && game.grid[by][block.x]) {
      canMove.set(i, false);
      continue;
    }
    const belowIdx = indexByCoord.get(`${block.x},${by}`);
    if (belowIdx !== undefined) {
      canMove.set(i, !!canMove.get(belowIdx));
      continue;
    }
    canMove.set(i, true);
  }

  const moved = blocks.some((_, i) => canMove.get(i));
  if (!moved) {
    lockActive();
    return false;
  }

  let rowsMoved = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (!canMove.get(i)) continue;
    blocks[i].y -= 1;
    rowsMoved += 1;
  }

  if (game.input.held.down && game.active.spawnDelayMs <= 0) {
    game.score += rowsMoved;
    storeHighScoreIfNeeded();
  }

  game.active.cells = blocks;
  return true;
}

function isCompact2x2(cells) {
  if (cells.length !== 4) return false;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxX - minX !== 1 || maxY - minY !== 1) return false;
  const set = new Set(cells.map((c) => `${c.x},${c.y}`));
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      if (!set.has(`${minX + rx},${minY + ry}`)) return false;
    }
  }
  return true;
}

function rotateActive(dir) {
  if (!game.active || !isCompact2x2(game.active.cells)) return false;
  const xs = game.active.cells.map((c) => c.x);
  const ys = game.active.cells.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const colorAt = Array.from({ length: 2 }, () => Array(2).fill(LIGHT));
  for (const cell of game.active.cells) {
    colorAt[cell.y - minY][cell.x - minX] = cell.color;
  }

  const next = Array.from({ length: 2 }, () => Array(2).fill(LIGHT));
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      if (dir > 0) next[y][x] = colorAt[1 - x][y];
      else next[y][x] = colorAt[x][1 - y];
    }
  }

  for (const cell of game.active.cells) {
    cell.color = next[cell.y - minY][cell.x - minX];
  }
  return true;
}

function lockActive() {
  if (!game.active) return;
  let toppedOut = false;
  for (const block of game.active.cells) {
    if (block.y >= ROWS) {
      toppedOut = true;
      continue;
    }
    if (block.y < 0 || block.x < 0 || block.x >= COLS) continue;
    game.grid[block.y][block.x] = { color: block.color, pending: false, special: false };
  }
  game.active = null;
  detectPendingSquares();
  if (toppedOut) {
    endGame('Top-out! Press R to restart.');
  }
}

function clearPendingFlags() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = game.grid[y][x];
      if (cell) cell.pending = false;
    }
  }
}

function detectPendingSquares() {
  clearPendingFlags();
  for (let y = 0; y < ROWS - 1; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      const a = game.grid[y][x];
      const b = game.grid[y][x + 1];
      const c = game.grid[y + 1][x];
      const d = game.grid[y + 1][x + 1];
      if (!a || !b || !c || !d) continue;
      if (a.color !== b.color || a.color !== c.color || a.color !== d.color) continue;
      a.pending = true;
      b.pending = true;
      c.pending = true;
      d.pending = true;
    }
  }
}

function gravityCompact() {
  for (let x = 0; x < COLS; x++) {
    const cells = [];
    for (let y = 0; y < ROWS; y++) {
      const cell = game.grid[y][x];
      if (cell) cells.push(cell);
    }
    for (let y = 0; y < ROWS; y++) {
      game.grid[y][x] = cells[y] ? cells[y] : null;
    }
  }
}

function maybeCountAnchorForColumn(anchorX, y, col) {
  if (anchorX !== col && anchorX + 1 !== col) return;
  const a = game.grid[y][anchorX];
  const b = game.grid[y][anchorX + 1];
  const c = game.grid[y + 1][anchorX];
  const d = game.grid[y + 1][anchorX + 1];
  if (!a || !b || !c || !d) return;
  if (!a.pending || !b.pending || !c.pending || !d.pending) return;
  if (a.color !== b.color || a.color !== c.color || a.color !== d.color) return;
  game.passAnchors.add(`${anchorX},${y}`);
}

function clearPendingInColumn(col) {
  if (col < 0 || col >= COLS) return;
  for (let y = 0; y < ROWS - 1; y++) {
    for (let x = Math.max(0, col - 1); x <= Math.min(COLS - 2, col); x++) {
      maybeCountAnchorForColumn(x, y, col);
    }
  }

  let any = false;
  for (let y = 0; y < ROWS; y++) {
    const cell = game.grid[y][col];
    if (!cell || !cell.pending) continue;
    game.grid[y][col] = null;
    any = true;
  }
  if (any) {
    gravityCompact();
    detectPendingSquares();
  }
}

function scoreSweepPass() {
  const count = game.passAnchors.size;
  if (count > 0) {
    const mult = count >= 4 ? 4 : 1;
    const points = 40 * count * mult;
    game.score += points;
    game.squaresClearedTotal += count;
    game.squaresTowardNextLevel += count;
    game.status = count >= 4
      ? `Sweep +${points} (${count} squares, x4 bonus)`
      : `Sweep +${points} (${count} squares)`;
    handleLevelUps();
    storeHighScoreIfNeeded();
  }
  game.passAnchors.clear();
}

function jitteredSweep(base) {
  const factor = 0.95 + game.rng.next() * 0.1;
  return Math.round(base * factor);
}

function handleLevelUps() {
  let req = levelThreshold(game.level);
  let leveled = false;
  while (game.squaresTowardNextLevel >= req) {
    game.squaresTowardNextLevel -= req;
    game.level += 1;
    game.skinIndex = (game.skinIndex + 1) % SKINS.length;
    game.sweepPeriodMs = jitteredSweep(SKINS[game.skinIndex].sweep);
    game.skinFlashMs = 420;
    leveled = true;
    req = levelThreshold(game.level);
  }
  if (leveled) {
    game.status = `Level ${game.level} - ${SKINS[game.skinIndex].name} skin`;
    updateThemeVars();
  }
}

function endGame(status) {
  game.gameOver = true;
  game.active = null;
  game.status = status;
  storeHighScoreIfNeeded();
}

function runTimeline(dt) {
  if (game.gameOver || game.paused) return;
  const step = (dt * COLS) / game.sweepPeriodMs;
  let next = game.timelineX + step;
  let prev = game.timelineX;

  while (next >= COLS) {
    processTimelineColumns(prev, COLS - 1e-6);
    scoreSweepPass();
    next -= COLS;
    prev = -1;
  }
  processTimelineColumns(prev, next);
  game.timelineX = next;
}

function processTimelineColumns(startX, endX) {
  const startCol = Math.floor(startX);
  const endCol = Math.floor(endX);
  for (let col = startCol + 1; col <= endCol; col++) {
    clearPendingInColumn(col);
  }
}

function handleHorizontalRepeat(dt) {
  const held = game.input.held;
  const repeat = game.input.repeat;
  if (held.left && !held.right) {
    repeat.left += dt;
    while (repeat.left >= 0) {
      moveActive(-1);
      repeat.left -= ARR_MS;
    }
  } else {
    repeat.left = -DAS_MS;
  }
  if (held.right && !held.left) {
    repeat.right += dt;
    while (repeat.right >= 0) {
      moveActive(1);
      repeat.right -= ARR_MS;
    }
  } else {
    repeat.right = -DAS_MS;
  }
}

function updateActivePiece(dt) {
  if (game.gameOver || game.paused) return;
  if (!game.active) {
    spawnPiece();
    return;
  }

  handleHorizontalRepeat(dt);

  if (game.input.pressed.rotateCW) rotateActive(1);
  if (game.input.pressed.rotateCCW) rotateActive(-1);

  if (game.active.spawnDelayMs > 0) {
    if (game.input.held.down) {
      game.active.spawnDelayMs = 0;
    } else {
      game.active.spawnDelayMs = Math.max(0, game.active.spawnDelayMs - dt);
      return;
    }
  }

  const interval = game.input.held.down
    ? Math.max(12, Math.floor(baseFallIntervalMs() / SOFT_DROP_MULTIPLIER))
    : baseFallIntervalMs();

  game.active.fallMs += dt;
  while (game.active && game.active.fallMs >= interval) {
    stepActiveFall();
    if (game.active) game.active.fallMs -= interval;
  }
}

function updateModeTimer(dt) {
  if (game.mode !== MODES.TIME || game.gameOver || game.paused) return;
  game.timeRemainingMs -= dt;
  if (game.timeRemainingMs <= 0) {
    game.timeRemainingMs = 0;
    endGame('Time up! Press R to restart.');
  }
}

function formatMs(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderHud() {
  scoreEl.textContent = String(game.score);
  highScoreEl.textContent = String(game.highScore);
  levelEl.textContent = String(game.level);
  skinEl.textContent = SKINS[game.skinIndex].name;
  modeLabelEl.textContent = game.mode === MODES.ENDLESS ? 'Endless' : `Time ${game.timeLimitSec}s`;
  timeLabelEl.textContent = game.mode === MODES.TIME ? formatMs(game.timeRemainingMs) : '--:--';
  statusEl.textContent = game.paused ? 'Paused' : game.status;
  pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
}

function setCanvasSize() {
  const parent = canvas.parentElement.getBoundingClientRect();
  const maxW = Math.max(300, Math.floor(parent.width - 20));
  const ratio = 16 / 10;
  let width = Math.min(maxW, 900);
  let height = Math.floor(width / ratio);
  if (height > 560) {
    height = 560;
    width = Math.floor(height * ratio);
  }
  canvas.width = width;
  canvas.height = height;

  const pad = Math.max(20, Math.floor(width * 0.06));
  view.boardX = pad;
  view.boardY = pad;
  view.boardW = width - pad * 2;
  view.boardH = height - pad * 2;
  view.cell = Math.floor(Math.min(view.boardW / COLS, view.boardH / ROWS));
  view.boardW = view.cell * COLS;
  view.boardH = view.cell * ROWS;
  view.boardX = Math.floor((width - view.boardW) / 2);
  view.boardY = Math.floor((height - view.boardH) / 2);
}

function boardToPixelX(x) {
  return view.boardX + x * view.cell;
}

function boardToPixelY(y) {
  return view.boardY + (ROWS - 1 - y) * view.cell;
}

function drawRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function skinColor(color) {
  const skin = SKINS[game.skinIndex];
  return color === DARK ? skin.dark : skin.light;
}

function drawCell(x, y, color, pending, alpha = 1) {
  const px = boardToPixelX(x);
  const py = boardToPixelY(y);
  const s = view.cell;
  const base = skinColor(color);
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(px, py, px + s, py + s);
  grad.addColorStop(0, '#ffffff44');
  grad.addColorStop(0.25, base);
  grad.addColorStop(1, '#00000066');
  ctx.fillStyle = grad;
  drawRoundedRect(px + 1, py + 1, s - 2, s - 2, Math.max(4, s * 0.16));
  ctx.fill();

  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 1;
  drawRoundedRect(px + 1.5, py + 1.5, s - 3, s - 3, Math.max(4, s * 0.16));
  ctx.stroke();

  if (pending) {
    const pulse = 0.35 + 0.3 * Math.sin(performance.now() * 0.012);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(px + 3, py + 3, s - 6, s - 6, Math.max(3, s * 0.12));
    ctx.fill();
  }
  ctx.restore();
}

function drawBoardBackground() {
  const skin = SKINS[game.skinIndex];
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, skin.bgTop);
  bg.addColorStop(1, skin.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.2,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.8
  );
  vignette.addColorStop(0, '#00000000');
  vignette.addColorStop(1, '#00000066');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#00000044';
  drawRoundedRect(view.boardX, view.boardY, view.boardW, view.boardH, 12);
  ctx.fill();

  ctx.strokeStyle = '#ffffff26';
  ctx.lineWidth = 2;
  drawRoundedRect(view.boardX, view.boardY, view.boardW, view.boardH, 12);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff12';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    const px = boardToPixelX(x);
    ctx.beginPath();
    ctx.moveTo(px, view.boardY);
    ctx.lineTo(px, view.boardY + view.boardH);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    const py = view.boardY + y * view.cell;
    ctx.beginPath();
    ctx.moveTo(view.boardX, py);
    ctx.lineTo(view.boardX + view.boardW, py);
    ctx.stroke();
  }
}

function drawTimeline() {
  const t = clamp((game.timelineX + 1) / COLS, 0, 1);
  const x = view.boardX + t * view.boardW;
  const line = SKINS[game.skinIndex].line;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const trail = ctx.createLinearGradient(x - 30, 0, x + 2, 0);
  trail.addColorStop(0, '#00000000');
  trail.addColorStop(1, `${line}66`);
  ctx.fillStyle = trail;
  ctx.fillRect(x - 30, view.boardY, 32, view.boardH);

  ctx.strokeStyle = `${line}dd`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, view.boardY);
  ctx.lineTo(x, view.boardY + view.boardH);
  ctx.stroke();
  ctx.restore();
}

function drawSkinFlash() {
  if (game.skinFlashMs <= 0) return;
  const alpha = clamp(game.skinFlashMs / 420, 0, 1) * 0.35;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawStateOverlay() {
  if (!game.paused && !game.gameOver) return;
  ctx.save();
  ctx.fillStyle = '#00000088';
  ctx.fillRect(view.boardX, view.boardY, view.boardW, view.boardH);
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 30px Trebuchet MS, Segoe UI, sans-serif';
  ctx.fillText(game.gameOver ? 'Game Over' : 'Paused', view.boardX + view.boardW / 2, view.boardY + view.boardH / 2);
  ctx.restore();
}

function draw() {
  drawBoardBackground();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = game.grid[y][x];
      if (!cell) continue;
      drawCell(x, y, cell.color, cell.pending);
    }
  }

  if (game.active) {
    for (const block of game.active.cells) {
      if (block.y < 0 || block.y >= ROWS) continue;
      drawCell(block.x, block.y, block.color, false, 0.95);
    }
  }

  drawTimeline();
  drawSkinFlash();
  drawStateOverlay();
}

function togglePause() {
  if (game.gameOver) return;
  game.paused = !game.paused;
  if (game.paused) {
    game.statusBeforePause = game.status;
    game.status = 'Paused';
  } else {
    game.status = game.statusBeforePause || game.status;
  }
}

function restartRun() {
  game.grid = makeGrid();
  game.active = null;
  game.queue = [generateMask(), generateMask(), generateMask()];
  game.score = 0;
  game.level = 1;
  game.squaresClearedTotal = 0;
  game.squaresTowardNextLevel = 0;
  game.timelineX = -1;
  game.passAnchors.clear();
  game.skinIndex = 0;
  game.sweepPeriodMs = jitteredSweep(SKINS[0].sweep);
  game.skinFlashMs = 0;
  game.paused = false;
  game.gameOver = false;
  game.status = game.mode === MODES.TIME ? 'Time Attack started.' : 'Endless started.';
  game.timeRemainingMs = game.mode === MODES.TIME ? game.timeLimitSec * 1000 : 0;
  game.input.held.left = false;
  game.input.held.right = false;
  game.input.held.down = false;
  game.input.repeat.left = -DAS_MS;
  game.input.repeat.right = -DAS_MS;
  game.input.clearPressed();
  loadHighScore();
  updateThemeVars();
  buildQueuePreview();
}

function applySettingsFromUI() {
  const nextMode = modeSelect.value === MODES.TIME ? MODES.TIME : MODES.ENDLESS;
  const nextLimit = Number(timeLimitSelect.value);
  game.mode = nextMode;
  game.timeLimitSec = TIME_LIMITS.includes(nextLimit) ? nextLimit : 180;
  game.layout = layoutSelect.value === 'vertical' ? 'vertical' : 'horizontal';
  applyLayoutClass();
  saveSettings();
  setCanvasSize();
  restartRun();
}

function update(dt) {
  if (game.skinFlashMs > 0) {
    game.skinFlashMs = Math.max(0, game.skinFlashMs - dt);
  }
  if (!isSettingsOpen()) {
    updateActivePiece(dt);
    runTimeline(dt);
    updateModeTimer(dt);
  }
  game.input.clearPressed();
}

function preventArrowScroll(ev) {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
  }
}

function handleKeyDown(ev) {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (isSettingsOpen()) return;
  const key = ev.key.toLowerCase();

  if (ev.repeat && key !== 'arrowdown') return;

  if (key === 'arrowleft' || key === 'a') {
    if (!game.input.held.left) {
      game.input.held.left = true;
      game.input.repeat.left = -DAS_MS;
      moveActive(-1);
    }
    ev.preventDefault();
    return;
  }

  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      game.input.repeat.right = -DAS_MS;
      moveActive(1);
    }
    ev.preventDefault();
    return;
  }

  if (key === 'arrowdown' || key === 's') {
    game.input.held.down = true;
    ev.preventDefault();
    return;
  }

  if (key === 'x' || key === 'e' || key === 'arrowup') {
    game.input.pressed.rotateCW = true;
    ev.preventDefault();
    return;
  }

  if (key === 'z' || key === 'q') {
    game.input.pressed.rotateCCW = true;
    ev.preventDefault();
    return;
  }

  if (key === 'p' || key === 'escape') {
    togglePause();
    ev.preventDefault();
    return;
  }

  if (key === 'r') {
    restartRun();
    ev.preventDefault();
  }
}

function handleKeyUp(ev) {
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    game.input.held.left = false;
    game.input.repeat.left = -DAS_MS;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    game.input.held.right = false;
    game.input.repeat.right = -DAS_MS;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    game.input.held.down = false;
    ev.preventDefault();
  }
}

function frame(now) {
  let dt = now - game.lastTime;
  game.lastTime = now;
  dt = clamp(dt, 0, 100);
  game._acc = (game._acc || 0) + dt;
  while (game._acc >= FIXED_DT) {
    update(FIXED_DT);
    game._acc -= FIXED_DT;
  }
  draw();
  renderHud();
  requestAnimationFrame(frame);
}

function init() {
  loadSettings();
  applyLayoutClass();
  syncSettingsUI();
  setCanvasSize();
  restartRun();

  document.addEventListener('keydown', preventArrowScroll, { passive: false });
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', () => {
    setCanvasSize();
  });

  newBtn.addEventListener('click', () => restartRun());
  pauseBtn.addEventListener('click', () => togglePause());
  settingsToggle.addEventListener('click', () => openSettings());
  settingsClose.addEventListener('click', () => closeSettings());
  settingsCancel.addEventListener('click', () => closeSettings());
  settingsApply.addEventListener('click', () => {
    applySettingsFromUI();
    closeSettings();
  });
  settingsModal.addEventListener('click', (ev) => {
    if (ev.target === settingsModal) closeSettings();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && isSettingsOpen()) {
      closeSettings();
      ev.preventDefault();
    }
  });

  requestAnimationFrame((now) => {
    game.lastTime = now;
    requestAnimationFrame(frame);
  });
}

init();
