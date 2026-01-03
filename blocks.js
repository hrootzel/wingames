import { SfxEngine } from './sfx_engine.js';
import { BANK_BLOCKS } from './sfx_bank_blocks.js';

const canvas = document.getElementById('blocks-canvas');
const ctx = canvas.getContext('2d');
const stageEl = document.querySelector('.blocks-stage');
const wrapEl = document.querySelector('.blocks-wrap');
const stageAreaEl = document.querySelector('.blocks-stage-area');
const sideEl = document.querySelector('.blocks-side');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const piecesEl = document.getElementById('pieces');
const previewStatusEl = document.getElementById('preview-status');

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');

const gridWInput = document.getElementById('gridW');
const gridHInput = document.getElementById('gridH');
const previewToggle = document.getElementById('optPreview');
const size1Input = document.getElementById('size1');
const size2Input = document.getElementById('size2');
const size3Input = document.getElementById('size3');
const size4Input = document.getElementById('size4');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.55 });
let audioUnlocked = false;

const FIXED_DT = 1000 / 60;
const DROP_SPEED_TABLE = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6,
  5, 5, 5, 4, 4, 4, 3, 3, 3, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 1,
];
const LINE_CLEAR_POINTS = [0, 40, 100, 300, 1200];
const DAS_FRAMES = 16;
const ARR_FRAMES = 6;
const SOFT_DROP_FRAMES = 2;
const QUEUE_MIN = 5;

const STORAGE = {
  gridW: 'blocks.gridW',
  gridH: 'blocks.gridH',
  showPreview: 'blocks.showPreview',
  size1: 'blocks.size1',
  size2: 'blocks.size2',
  size3: 'blocks.size3',
  size4: 'blocks.size4',
};

const DEFAULT_SETTINGS = {
  w: 10,
  h: 20,
  showPreview: true,
  enabledSizes: {
    1: false,
    2: false,
    3: false,
    4: true,
  },
};

const PALETTE = [
  '#0b1020',
  '#ef4444',
  '#38bdf8',
  '#facc15',
  '#a855f7',
  '#22c55e',
  '#f97316',
  '#3b82f6',
  '#f472b6',
];

const BASE_PIECES = [
  { id: 'I1', size: 1, cells: [{ x: 0, y: 0 }] },
  { id: 'I2', size: 2, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { id: 'I3', size: 3, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
  { id: 'L3', size: 3, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: 'T4', size: 4, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] },
  { id: 'J4', size: 4, cells: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }] },
  { id: 'Z4', size: 4, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  { id: 'O4', size: 4, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: 'S4', size: 4, cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: 'L4', size: 4, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
  { id: 'I4', size: 4, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
];

const NES_PIECE_IDS = ['T4', 'J4', 'Z4', 'O4', 'S4', 'L4', 'I4'];

const COLOR_BY_ID = {
  I4: 2,
  O4: 3,
  T4: 4,
  S4: 5,
  Z4: 1,
  L4: 6,
  J4: 7,
  I3: 8,
  L3: 8,
  I2: 8,
  I1: 8,
};

const input = makeInput();
const state = makeState();
let settings = loadSettings();
const view = {
  cell: 24,
  pad: 16,
  boardLeft: 0,
  boardTop: 0,
  boardW: 0,
  boardH: 0,
};

const CATALOG = buildCatalog(BASE_PIECES);
const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((piece) => [piece.id, piece]));

function makeInput() {
  return {
    held: { left: false, right: false, down: false },
    pressed: { rotate: false, rotateCCW: false, hardDrop: false },
    clearPressed() {
      this.pressed.rotate = false;
      this.pressed.rotateCCW = false;
      this.pressed.hardDrop = false;
    },
  };
}

function makeState() {
  return {
    settings: null,
    board: [],
    active: null,
    nextQueue: [],
    score: 0,
    lines: 0,
    level: 0,
    startLevel: 0,
    pieces: 0,
    paused: false,
    over: false,
    fallTimer: 0,
    softDropCounter: 0,
    softDropPoints: 0,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    rng: makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0),
    nesSeed: 0,
    spawnCount: 0,
    spawnIndex: null,
    dasDir: 0,
    dasCounter: 0,
    arrCounter: 0,
  };
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function playSfx(name, payload) {
  if (!audioUnlocked) return;
  sfx.play(BANK_BLOCKS, name, payload);
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function readStoredBool(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

function sanitizeSettings(next) {
  const w = clamp(toNumber(next.w, DEFAULT_SETTINGS.w), 6, 24);
  const h = clamp(toNumber(next.h, DEFAULT_SETTINGS.h), 12, 40);
  const showPreview =
    typeof next.showPreview === 'boolean' ? next.showPreview : DEFAULT_SETTINGS.showPreview;
  const enabledSizes = {
    1: DEFAULT_SETTINGS.enabledSizes[1],
    2: DEFAULT_SETTINGS.enabledSizes[2],
    3: DEFAULT_SETTINGS.enabledSizes[3],
    4: DEFAULT_SETTINGS.enabledSizes[4],
  };
  if (next.enabledSizes) {
    for (const size of [1, 2, 3, 4]) {
      if (Object.prototype.hasOwnProperty.call(next.enabledSizes, size)) {
        enabledSizes[size] = Boolean(next.enabledSizes[size]);
      }
    }
  }
  if (!enabledSizes[1] && !enabledSizes[2] && !enabledSizes[3] && !enabledSizes[4]) {
    enabledSizes[4] = true;
  }
  return { w, h, showPreview, enabledSizes };
}

function loadSettings() {
  const w = toNumber(localStorage.getItem(STORAGE.gridW), DEFAULT_SETTINGS.w);
  const h = toNumber(localStorage.getItem(STORAGE.gridH), DEFAULT_SETTINGS.h);
  const showPreview = readStoredBool(STORAGE.showPreview, DEFAULT_SETTINGS.showPreview);
  const enabledSizes = {
    1: readStoredBool(STORAGE.size1, DEFAULT_SETTINGS.enabledSizes[1]),
    2: readStoredBool(STORAGE.size2, DEFAULT_SETTINGS.enabledSizes[2]),
    3: readStoredBool(STORAGE.size3, DEFAULT_SETTINGS.enabledSizes[3]),
    4: readStoredBool(STORAGE.size4, DEFAULT_SETTINGS.enabledSizes[4]),
  };
  return sanitizeSettings({ w, h, showPreview, enabledSizes });
}

function saveSettings(next) {
  localStorage.setItem(STORAGE.gridW, String(next.w));
  localStorage.setItem(STORAGE.gridH, String(next.h));
  localStorage.setItem(STORAGE.showPreview, String(next.showPreview));
  localStorage.setItem(STORAGE.size1, String(next.enabledSizes[1]));
  localStorage.setItem(STORAGE.size2, String(next.enabledSizes[2]));
  localStorage.setItem(STORAGE.size3, String(next.enabledSizes[3]));
  localStorage.setItem(STORAGE.size4, String(next.enabledSizes[4]));
}

function syncSettingsUI(next) {
  gridWInput.value = String(next.w);
  gridHInput.value = String(next.h);
  previewToggle.checked = next.showPreview;
  size1Input.checked = next.enabledSizes[1];
  size2Input.checked = next.enabledSizes[2];
  size3Input.checked = next.enabledSizes[3];
  size4Input.checked = next.enabledSizes[4];
}

function makeRng(seed) {
  let t = seed >>> 0;
  return {
    next() {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(n) {
      return Math.floor(this.next() * n);
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBoard(w, h) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 0));
}

function normalizeCells(cells) {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

function rotateCellsCW(cells) {
  const rotated = cells.map((c) => ({ x: c.y, y: -c.x }));
  return normalizeCells(rotated);
}

function cellsKey(cells) {
  return cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join('|');
}

function buildCatalog(basePieces) {
  return basePieces.map((piece) => {
    const rots = [normalizeCells(piece.cells)];
    for (let i = 1; i < 4; i += 1) {
      rots.push(rotateCellsCW(rots[i - 1]));
    }
    const unique = [];
    const seen = new Set();
    for (const r of rots) {
      const key = cellsKey(r);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }
    return {
      ...piece,
      rots: unique,
      colorIndex: COLOR_BY_ID[piece.id] || 1,
    };
  });
}

function cellsBounds(cells) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function resetRng() {
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  state.rng = makeRng(seed);
  state.nesSeed = (seed ^ (seed >>> 16)) & 0xffff;
  state.spawnCount = 0;
  state.spawnIndex = null;
}

function nextNesSeed(seed) {
  const tap = (seed & 0x02) ^ ((seed >> 8) & 0x02);
  const carry = tap ? 1 : 0;
  return ((seed >> 1) | (carry << 15)) & 0xffff;
}

function usesNesRandomizer() {
  const e = state.settings.enabledSizes;
  return e[4] && !e[1] && !e[2] && !e[3];
}

function nextNesPieceId() {
  state.spawnCount = (state.spawnCount + 1) & 0xff;
  let index = (state.nesSeed + state.spawnCount) & 0x07;
  const hasPrev = state.spawnIndex !== null;
  if (index === 7 || (hasPrev && index === state.spawnIndex)) {
    state.nesSeed = nextNesSeed(state.nesSeed);
    const offset = hasPrev ? state.spawnIndex : 0;
    index = (state.nesSeed & 0x07) + offset;
    while (index >= 7) {
      index -= 7;
    }
  }
  state.spawnIndex = index;
  return NES_PIECE_IDS[index];
}

function enabledCatalog() {
  const e = state.settings.enabledSizes;
  return CATALOG.filter((piece) => e[piece.size]);
}

function refillQueue() {
  while (state.nextQueue.length < QUEUE_MIN) {
    if (usesNesRandomizer()) {
      const id = nextNesPieceId();
      state.nextQueue.push(CATALOG_BY_ID[id]);
    } else {
      const bag = enabledCatalog().slice();
      shuffleInPlace(bag, state.rng);
      state.nextQueue.push(...bag);
    }
  }
}

function peekNextPiece() {
  refillQueue();
  return state.nextQueue[0];
}

function dropSpeedForLevel() {
  const index = Math.min(state.level, DROP_SPEED_TABLE.length - 1);
  return DROP_SPEED_TABLE[index];
}

function updateLevel() {
  const target = Math.floor(state.lines / 10);
  if (target > state.level) {
    state.level = target;
  }
}

function applyScoring(cleared) {
  if (cleared <= 0) return;
  const base = LINE_CLEAR_POINTS[cleared] || 0;
  state.score += base * (state.level + 1);
}

function clearFullLines() {
  let cleared = 0;
  for (let y = state.settings.h - 1; y >= 0; y -= 1) {
    if (state.board[y].every((v) => v !== 0)) {
      state.board.splice(y, 1);
      state.board.unshift(new Array(state.settings.w).fill(0));
      cleared += 1;
      y += 1;
    }
  }
  if (cleared > 0) {
    state.lines += cleared;
    updateLevel();
  }
  return cleared;
}

function collides(piece, nx, ny, nrot) {
  const cells = piece.rots[nrot];
  for (const c of cells) {
    const x = nx + c.x;
    const y = ny + c.y;
    if (x < 0 || x >= state.settings.w || y >= state.settings.h) return true;
    if (y >= 0 && state.board[y][x] !== 0) return true;
  }
  return false;
}

function tryMove(dx, dy) {
  const p = state.active;
  if (!p) return false;
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (!collides(p, nx, ny, p.rot)) {
    p.x = nx;
    p.y = ny;
    return true;
  }
  return false;
}

function tryShift(dx) {
  if (tryMove(dx, 0)) {
    playSfx('shift');
    return true;
  }
  return false;
}

const KICKS = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -2, y: 0 },
  { x: 2, y: 0 },
];

function tryRotate(dir) {
  const p = state.active;
  if (!p) return false;
  const rots = p.rots.length;
  const nrot = (p.rot + (dir > 0 ? 1 : -1) + rots) % rots;
  for (const k of KICKS) {
    const nx = p.x + k.x;
    const ny = p.y + k.y;
    if (!collides(p, nx, ny, nrot)) {
      p.x = nx;
      p.y = ny;
      p.rot = nrot;
      return true;
    }
  }
  return false;
}

function lockPiece(opts = {}) {
  const p = state.active;
  if (!p) return;
  const silent = opts.silent === true;
  let toppedOut = false;
  for (const c of p.rots[p.rot]) {
    const x = p.x + c.x;
    const y = p.y + c.y;
    if (y < 0) {
      toppedOut = true;
      continue;
    }
    state.board[y][x] = p.colorIndex;
  }
  state.active = null;
  state.pieces += 1;
  if (!silent) {
    playSfx('lock');
  }
  if (state.softDropPoints > 0) {
    state.score += state.softDropPoints;
    state.softDropPoints = 0;
  }
  const prevLevel = state.level;
  const cleared = clearFullLines();
  applyScoring(cleared);
  if (cleared > 0) {
    if (cleared >= 4) {
      playSfx('tetris');
    } else {
      playSfx('lineClear', { lines: cleared });
    }
  }
  if (state.level > prevLevel) {
    playSfx('levelUp');
  }
  if (toppedOut) {
    setGameOver();
    return;
  }
  spawnNextPiece();
}

function hardDrop() {
  if (!state.active) return;
  while (tryMove(0, 1)) {}
  playSfx('hardDrop');
  lockPiece({ silent: true });
}

function spawnNextPiece() {
  refillQueue();
  const proto = state.nextQueue.shift();
  const shape = proto.rots[0];
  const bounds = cellsBounds(shape);
  const spawnX = Math.floor((state.settings.w - bounds.width) / 2);
  const spawnY = -2;
  const piece = {
    id: proto.id,
    size: proto.size,
    rots: proto.rots,
    rot: 0,
    x: spawnX,
    y: spawnY,
    colorIndex: proto.colorIndex,
  };
  if (collides(piece, piece.x, piece.y, piece.rot)) {
    setGameOver();
    return;
  }
  state.active = piece;
  state.status = 'Playing.';
}

function setGameOver() {
  state.over = true;
  state.paused = false;
  state.active = null;
  state.status = 'Game Over.';
  pauseBtn.textContent = 'Pause';
  playSfx('gameOver');
}

function heldDirection() {
  if (input.held.left && input.held.right) return state.dasDir || 0;
  if (input.held.left) return -1;
  if (input.held.right) return 1;
  return 0;
}

function handleDAS() {
  const dir = heldDirection();
  if (!dir) {
    state.dasDir = 0;
    state.dasCounter = 0;
    state.arrCounter = 0;
    return;
  }
  if (dir !== state.dasDir) {
    state.dasDir = dir;
    state.dasCounter = 0;
    state.arrCounter = 0;
    tryShift(dir);
    return;
  }
  state.dasCounter += 1;
  if (state.dasCounter < DAS_FRAMES) return;
  state.arrCounter += 1;
  if (state.arrCounter >= ARR_FRAMES) {
    state.arrCounter = 0;
    tryShift(dir);
  }
}

function handleSoftDrop() {
  if (!input.held.down) {
    state.softDropCounter = 0;
    return false;
  }
  state.softDropCounter += 1;
  if (state.softDropCounter < SOFT_DROP_FRAMES) return false;
  state.softDropCounter = 0;
  state.fallTimer = 0;
  if (tryMove(0, 1)) {
    state.softDropPoints += 1;
    return false;
  }
  lockPiece();
  return true;
}

function handleGravity() {
  state.fallTimer += 1;
  if (state.fallTimer < dropSpeedForLevel()) return;
  state.fallTimer = 0;
  if (!tryMove(0, 1)) {
    lockPiece();
  }
}

function stepGame() {
  if (state.over || state.paused || isSettingsOpen()) {
    input.clearPressed();
    return;
  }
  if (!state.active) {
    spawnNextPiece();
    input.clearPressed();
    return;
  }

  if (input.pressed.rotate) {
    if (tryRotate(1)) playSfx('rotate');
  }
  if (input.pressed.rotateCCW) {
    if (tryRotate(-1)) playSfx('rotate');
  }
  if (input.pressed.hardDrop) {
    hardDrop();
    input.clearPressed();
    return;
  }

  handleDAS();
  if (handleSoftDrop()) {
    input.clearPressed();
    return;
  }
  handleGravity();
  input.clearPressed();
}

function updateView() {
  const pad = 16;
  const cell = Math.floor(
    Math.min(
      (canvas.width - pad * 2) / state.settings.w,
      (canvas.height - pad * 2) / state.settings.h
    )
  );
  view.cell = Math.max(8, cell);
  view.pad = pad;
  view.boardW = view.cell * state.settings.w;
  view.boardH = view.cell * state.settings.h;
  view.boardLeft = Math.floor((canvas.width - view.boardW) / 2);
  view.boardTop = Math.floor((canvas.height - view.boardH) / 2);
}

function resizeCanvasToStage() {
  if (!state.settings || !stageEl || !stageAreaEl || !wrapEl) return;
  const wrapRect = wrapEl.getBoundingClientRect();
  const areaStyle = window.getComputedStyle(stageAreaEl);
  const stageStyle = window.getComputedStyle(stageEl);
  const gapX = parseFloat(areaStyle.columnGap) || parseFloat(areaStyle.gap) || 0;
  const sideWidth = sideEl ? sideEl.getBoundingClientRect().width : 0;
  const padX = parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight);
  const padY = parseFloat(stageStyle.paddingTop) + parseFloat(stageStyle.paddingBottom);
  const maxW = Math.max(0, wrapRect.width - sideWidth - gapX - padX);
  const maxH = Math.max(0, wrapRect.height - padY);
  if (maxW <= 0 || maxH <= 0) return;
  const ratio = state.settings.w / state.settings.h;
  let width = maxW;
  let height = maxH;
  if (width / height > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }
  const wPx = Math.max(1, Math.floor(width));
  const hPx = Math.max(1, Math.floor(height));
  canvas.style.width = `${wPx}px`;
  canvas.style.height = `${hPx}px`;
  canvas.width = wPx;
  canvas.height = hPx;
  updateView();
}

function palette(index) {
  return PALETTE[index] || '#e2e8f0';
}

function drawCell(context, x, y, cell, color) {
  const px = x * cell;
  const py = y * cell;
  context.fillStyle = color;
  context.fillRect(px, py, cell, cell);
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
}

function drawBoard() {
  ctx.save();
  ctx.translate(view.boardLeft, view.boardTop);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(0, 0, view.boardW, view.boardH);

  for (let y = 0; y < state.settings.h; y += 1) {
    for (let x = 0; x < state.settings.w; x += 1) {
      const v = state.board[y][x];
      if (v !== 0) {
        drawCell(ctx, x, y, view.cell, palette(v));
      }
    }
  }

  if (state.active) {
    const p = state.active;
    const color = palette(p.colorIndex);
    for (const c of p.rots[p.rot]) {
      const x = p.x + c.x;
      const y = p.y + c.y;
      if (y >= 0) {
        drawCell(ctx, x, y, view.cell, color);
      }
    }
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x <= state.settings.w; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * view.cell + 0.5, 0);
    ctx.lineTo(x * view.cell + 0.5, view.boardH);
    ctx.stroke();
  }
  for (let y = 0; y <= state.settings.h; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * view.cell + 0.5);
    ctx.lineTo(view.boardW, y * view.cell + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOverlay(text) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 15, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px Trebuchet MS, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!state.settings.showPreview) return;
  const next = peekNextPiece();
  if (!next) return;
  const shape = next.rots[0];
  const bounds = cellsBounds(shape);
  const cell = Math.min(
    24,
    Math.floor(
      Math.min(
        previewCanvas.width / (bounds.width + 2),
        previewCanvas.height / (bounds.height + 2)
      )
    )
  );
  const offsetX = Math.floor((previewCanvas.width - bounds.width * cell) / 2);
  const offsetY = Math.floor((previewCanvas.height - bounds.height * cell) / 2);
  previewCtx.save();
  previewCtx.translate(offsetX, offsetY);
  const color = palette(next.colorIndex);
  for (const c of shape) {
    drawCell(previewCtx, c.x, c.y, cell, color);
  }
  previewCtx.restore();
}

function updateHud() {
  statusEl.textContent = state.status;
  scoreEl.textContent = state.score;
  linesEl.textContent = state.lines;
  levelEl.textContent = state.level;
  piecesEl.textContent = state.pieces;
}

function updatePreviewStatus() {
  if (!state.settings || !state.settings.showPreview) {
    previewStatusEl.textContent = 'Preview off.';
    previewCanvas.style.opacity = '0.35';
    return;
  }
  previewStatusEl.textContent = 'Preview on.';
  previewCanvas.style.opacity = '1';
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  if (state.paused) drawOverlay('PAUSED');
  if (state.over) drawOverlay('GAME OVER');
  drawPreview();
  updateHud();
}

function applySettingsFromUI() {
  const next = sanitizeSettings({
    w: gridWInput.value,
    h: gridHInput.value,
    showPreview: previewToggle.checked,
    enabledSizes: {
      1: size1Input.checked,
      2: size2Input.checked,
      3: size3Input.checked,
      4: size4Input.checked,
    },
  });
  settings = next;
  saveSettings(settings);
  syncSettingsUI(settings);
  startNewGame({ ...settings, enabledSizes: { ...settings.enabledSizes } });
  return true;
}

function startNewGame(settings) {
  state.settings = { ...settings, enabledSizes: { ...settings.enabledSizes } };
  state.board = makeBoard(settings.w, settings.h);
  state.nextQueue = [];
  state.score = 0;
  state.lines = 0;
  state.level = settings.startLevel || 0;
  state.startLevel = settings.startLevel || 0;
  state.pieces = 0;
  state.paused = false;
  state.over = false;
  state.fallTimer = 0;
  state.softDropCounter = 0;
  state.softDropPoints = 0;
  state.status = 'Ready.';
  state.statusBeforePause = 'Ready.';
  state.dasDir = 0;
  state.dasCounter = 0;
  state.arrCounter = 0;
  pauseBtn.textContent = 'Pause';
  resetRng();
  resizeCanvasToStage();
  refillQueue();
  spawnNextPiece();
  updatePreviewStatus();
  updateHud();
}

function togglePause() {
  if (state.over) return;
  const next = !state.paused;
  if (next) {
    state.statusBeforePause = state.status;
    state.status = 'Paused.';
  } else {
    state.status = state.statusBeforePause || state.status;
  }
  state.paused = next;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

function isSettingsOpen() {
  return settingsModal && !settingsModal.classList.contains('hidden');
}

function openSettings() {
  syncSettingsUI(settings);
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

function preventArrowScroll(ev) {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.key === 'ArrowDown' || ev.key === 'Down') {
    ev.preventDefault();
  }
}

function handleKeyDown(ev) {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  unlockAudio();
  if (isSettingsOpen()) return;
  const key = ev.key.toLowerCase();
  if (ev.repeat) {
    if (key === 'arrowdown') ev.preventDefault();
    return;
  }

  if (key === 'arrowleft' || key === 'a') {
    input.held.left = true;
    if (!state.paused && !state.over) {
      state.dasDir = -1;
      state.dasCounter = 0;
      state.arrCounter = 0;
      tryShift(-1);
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    input.held.right = true;
    if (!state.paused && !state.over) {
      state.dasDir = 1;
      state.dasCounter = 0;
      state.arrCounter = 0;
      tryShift(1);
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowdown' || key === 's') {
    input.held.down = true;
    ev.preventDefault();
    return;
  }
  if (key === 'arrowup' || key === 'x' || key === 'w') {
    input.pressed.rotate = true;
    ev.preventDefault();
    return;
  }
  if (key === 'z' || key === 'q') {
    input.pressed.rotateCCW = true;
    ev.preventDefault();
    return;
  }
  if (key === ' ') {
    input.pressed.hardDrop = true;
    ev.preventDefault();
    return;
  }
  if (key === 'p') {
    togglePause();
    ev.preventDefault();
    return;
  }
  if (key === 'r') {
    startNewGame({ ...settings, enabledSizes: { ...settings.enabledSizes } });
    ev.preventDefault();
  }
}

function handleKeyUp(ev) {
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    input.held.left = false;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    input.held.right = false;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    input.held.down = false;
    ev.preventDefault();
  }
}

function loop() {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += now - last;
    last = now;
    while (acc >= FIXED_DT) {
      stepGame();
      acc -= FIXED_DT;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('resize', () => resizeCanvasToStage());
settingsToggle.addEventListener('click', () => openSettings());
settingsClose.addEventListener('click', () => closeSettings());
settingsCancel.addEventListener('click', () => closeSettings());
settingsModal.addEventListener('click', (ev) => {
  if (ev.target === settingsModal) closeSettings();
});
settingsApply.addEventListener('click', () => {
  if (applySettingsFromUI()) closeSettings();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && isSettingsOpen()) {
    closeSettings();
    ev.preventDefault();
  }
});
newBtn.addEventListener('click', () => {
  startNewGame({ ...settings, enabledSizes: { ...settings.enabledSizes } });
});
pauseBtn.addEventListener('click', () => togglePause());

syncSettingsUI(settings);
startNewGame({ ...settings, enabledSizes: { ...settings.enabledSizes } });
loop();
