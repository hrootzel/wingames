import { SfxEngine } from './sfx_engine.js';
import { BANK_PUZZLEPUNCHER } from './sfx_bank_puzzle_puncher.js';
import { roundRect } from './rendering_engine.js';
import { initGameShell } from './game-shell.js';
import {
  drawGemFill,
  drawGemBorder,
  drawPowerEdges,
  drawCrashOverlay,
  drawDiamond,
  drawGarbageOverlay,
  drawCounterNumber,
  drawPowerRectGloss,
} from './puzzle_puncher_sprite.js';

const W = 6;
const H = 13;
const VISIBLE_H = 12;
const SPAWN_COL = 3;

const Kind = {
  EMPTY: 'EMPTY',
  NORMAL: 'NORMAL',
  CRASH: 'CRASH',
  DIAMOND: 'DIAMOND',
  GARBAGE: 'GARBAGE',
};

const GameState = {
  SPAWN: 'SPAWN',
  FALLING: 'FALLING',
  RESOLVE: 'RESOLVE',
  GAME_OVER: 'GAME_OVER',
};

const COLORS = ['R', 'G', 'B', 'Y'];

const PALETTE = {
  R: { base: '#ef4444', light: '#fca5a5', dark: '#b91c1c', stroke: '#7f1d1d' },
  G: { base: '#22c55e', light: '#86efac', dark: '#15803d', stroke: '#14532d' },
  B: { base: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8', stroke: '#1e3a8a' },
  Y: { base: '#facc15', light: '#fde68a', dark: '#d97706', stroke: '#a16207' },
  X: { base: '#6b7280', light: '#d1d5db', dark: '#374151', stroke: '#111827' },
};

const SCORE = {
  NORMAL: 10,
  CRASH: 12,
  POWER: 25,
  GARBAGE: 6,
  TECH: 10000,
  ALL_CLEAR: 5000,
};

const CHAIN_BONUS_TABLE = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288,
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672,
];

const SIZE_BONUS_TABLE = [
  0, 0, 0, 0, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 19, 22, 25, 28, 32, 36, 40,
];

const DAS = 160;
const ARR = 60;
const LOCK_DELAY = 230;
const FIXED_DT = 1000 / 60;
const RESOLVE_DROP_INTERVAL = 60;
const PRESSURE_INTERVAL_BASE = 14000;
const PRESSURE_PER_LOCK = 0.28;
const PRESSURE_WAVE_STRENGTH = 0.9;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const next2Canvas = document.getElementById('next2-canvas');
const next2Ctx = next2Canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const chainEl = document.getElementById('chain');
const levelEl = document.getElementById('level');
const piecesEl = document.getElementById('pieces');
const pressureEl = document.getElementById('pressure');
const statusEl = document.getElementById('status');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.6 });
let audioUnlocked = false;

const view = {
  cellSize: 40,
  boardLeft: 0,
  boardTop: 0,
  boardWidth: 0,
  boardHeight: 0,
  colX: [],
  rowY: [],
  staticLayer: null,
  staticCtx: null,
  staticDirty: true,
  boardBgGrad: null,
};

const game = makeGame();

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
    int(n) {
      return Math.floor(this.next() * n);
    },
  };
}

function makeEmptyCell() {
  return { kind: Kind.EMPTY, color: null, powerRectId: 0, bounce: 0, face: 0, shine: 0, counter: 0 };
}

function makeBoard() {
  const cells = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => makeEmptyCell())
  );
  return { cells };
}

function makeInput() {
  return {
    held: { left: false, right: false, down: false },
    pressed: { rotateCW: false, rotateCCW: false, hardDrop: false },
    clearPressed() {
      this.pressed.rotateCW = false;
      this.pressed.rotateCCW = false;
      this.pressed.hardDrop = false;
    },
  };
}

function makeGame() {
  const seed = (Date.now() >>> 0) ^ (Math.random() * 0xffffffff);
  return {
    rng: makeRng(seed),
    board: makeBoard(),
    input: makeInput(),
    repeat: { left: -DAS, right: -DAS },
    state: GameState.SPAWN,
    paused: false,
    active: null,
    queue: [],
    pendingDiamond: null,
    resolve: null,
    powerRects: new Map(),
    pieceIndex: 0,
    level: 1,
    score: 0,
    lastChain: 0,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    pressure: {
      meter: 0,
      waveTimer: 0,
      pendingRows: 0,
    },
    rngState: {
      crashDrought: 0,
    },
    fx: {
      phase: 0,
      hitstop: 0,
      shake: 0,
      particles: [],
      waves: [],
      banners: [],
      warningTimer: 0,
    },
    timers: { gravityElapsed: 0 },
  };
}

function cloneCell(cell) {
  return {
    kind: cell.kind,
    color: cell.color,
    powerRectId: 0,
    bounce: cell.bounce,
    face: cell.face,
    shine: cell.shine,
    counter: cell.counter ?? 0,
  };
}

function makeGemCell(gem) {
  const cell = makeEmptyCell();
  cell.kind = gem.kind;
  cell.color = gem.color;
  cell.face = game.rng.int(4);
  cell.shine = game.rng.next();
  cell.bounce = 1;
  return cell;
}

function resetBoard() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c] = makeEmptyCell();
    }
  }
  game.powerRects.clear();
}

function fillQueue() {
  while (game.queue.length < 3) {
    game.queue.push(rollPiece(game.rng, game.pieceIndex + game.queue.length + 1));
  }
}

function newGame() {
  resetBoard();
  const seed = (Date.now() >>> 0) ^ (Math.random() * 0xffffffff);
  game.rng = makeRng(seed);
  game.input.held.left = false;
  game.input.held.right = false;
  game.input.held.down = false;
  game.input.clearPressed();
  game.repeat.left = -DAS;
  game.repeat.right = -DAS;
  game.state = GameState.SPAWN;
  game.paused = false;
  game.active = null;
  game.queue = [];
  game.pendingDiamond = null;
  game.resolve = null;
  game.powerRects.clear();
  game.pieceIndex = 0;
  game.level = 1;
  game.score = 0;
  game.lastChain = 0;
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.pressure.meter = 0;
  game.pressure.waveTimer = 0;
  game.pressure.pendingRows = 0;
  game.rngState.crashDrought = 0;
  game.fx.phase = 0;
  game.fx.hitstop = 0;
  game.fx.shake = 0;
  game.fx.particles.length = 0;
  game.fx.waves.length = 0;
  game.fx.banners.length = 0;
  game.fx.warningTimer = 0;
  game.timers.gravityElapsed = 0;
  fillQueue();
  pauseBtn.textContent = 'Pause';
}

function rollGem(rng) {
  const color = COLORS[rng.int(COLORS.length)];
  const chance = Math.min(0.3, 0.1 + game.rngState.crashDrought * 0.02);
  const isCrash = rng.next() < chance;
  if (isCrash) {
    game.rngState.crashDrought = 0;
    return { kind: Kind.CRASH, color };
  }
  game.rngState.crashDrought += 1;
  return { kind: Kind.NORMAL, color };
}

function rollPiece(rng, pieceIndex) {
  const isDiamond = pieceIndex % 25 === 0;
  if (isDiamond) {
    const gem = rollGem(rng);
    if (rng.int(2) === 0) {
      return { a: { kind: Kind.DIAMOND, color: null }, b: gem };
    }
    return { a: gem, b: { kind: Kind.DIAMOND, color: null } };
  }
  return { a: rollGem(rng), b: rollGem(rng) };
}

function orientOffset(orient) {
  switch (orient & 3) {
    case 0:
      return { dr: 1, dc: 0 };
    case 1:
      return { dr: 0, dc: 1 };
    case 2:
      return { dr: -1, dc: 0 };
    case 3:
      return { dr: 0, dc: -1 };
    default:
      return { dr: 1, dc: 0 };
  }
}

function makeActivePiece(spec) {
  return {
    pivotRow: 11,
    pivotCol: SPAWN_COL,
    orient: 0,
    gemA: { kind: spec.a.kind, color: spec.a.color },
    gemB: { kind: spec.b.kind, color: spec.b.color },
    lockTimer: 0,
  };
}

function pieceCells(piece, orientOverride) {
  const orient = orientOverride === undefined ? piece.orient : orientOverride;
  const off = orientOffset(orient);
  return [
    { row: piece.pivotRow, col: piece.pivotCol, gem: piece.gemA },
    { row: piece.pivotRow + off.dr, col: piece.pivotCol + off.dc, gem: piece.gemB },
  ];
}

function inBounds(row, col) {
  return row >= 0 && row < H && col >= 0 && col < W;
}

function cellAt(row, col) {
  return inBounds(row, col) ? game.board.cells[row][col] : null;
}

function isEmptyCell(row, col) {
  const cell = cellAt(row, col);
  return cell && cell.kind === Kind.EMPTY;
}

function canPlace(cells) {
  for (const cell of cells) {
    if (!inBounds(cell.row, cell.col)) return false;
    if (!isEmptyCell(cell.row, cell.col)) return false;
  }
  return true;
}

function tryMovePiece(dr, dc) {
  if (!game.active) return false;
  const cells = pieceCells(game.active).map((cell) => ({
    row: cell.row + dr,
    col: cell.col + dc,
  }));
  if (!canPlace(cells)) return false;
  game.active.pivotRow += dr;
  game.active.pivotCol += dc;
  game.active.lockTimer = 0;
  return true;
}

function tryRotate(dir) {
  if (!game.active) return false;
  const nextOrient = (game.active.orient + dir + 4) & 3;
  const kicks = [
    { dr: 0, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 1 },
  ];
  for (const kick of kicks) {
    const cells = pieceCells(game.active, nextOrient).map((cell) => ({
      row: cell.row + kick.dr,
      col: cell.col + kick.dc,
    }));
    if (!canPlace(cells)) continue;
    game.active.orient = nextOrient;
    game.active.pivotRow += kick.dr;
    game.active.pivotCol += kick.dc;
    game.active.lockTimer = 0;
    return true;
  }
  return false;
}

function currentGravityInterval() {
  const base = Math.max(160, 820 - (game.level - 1) * 60);
  if (game.input.held.down) {
    return Math.max(35, Math.floor(base / 10));
  }
  return base;
}

function spawnPiece() {
  game.pieceIndex += 1;
  game.level = 1 + Math.floor((game.pieceIndex - 1) / 20);
  fillQueue();
  const spec = game.queue.shift();
  game.active = makeActivePiece(spec);
  fillQueue();
  const cells = pieceCells(game.active);
  if (!canPlace(cells)) {
    game.state = GameState.GAME_OVER;
    game.status = 'Game over. Press R to restart.';
    sfx.play(BANK_PUZZLEPUNCHER, 'gameOver');
    return;
  }
  game.state = GameState.FALLING;
  game.timers.gravityElapsed = 0;
  game.lastChain = 0;
}

function lockPiece() {
  if (!game.active) return;
  sfx.play(BANK_PUZZLEPUNCHER, 'lock');
  const cells = pieceCells(game.active);
  let diamondCell = null;
  for (const cell of cells) {
    if (cell.gem.kind === Kind.DIAMOND) {
      const next = makeEmptyCell();
      next.kind = Kind.DIAMOND;
      next.color = null;
      next.bounce = 1;
      next.shine = game.rng.next();
      diamondCell = { row: cell.row, col: cell.col };
      game.board.cells[cell.row][cell.col] = next;
    } else {
      game.board.cells[cell.row][cell.col] = makeGemCell(cell.gem);
    }
  }

  tickGarbageCounters();

  game.pendingDiamond = null;
  if (diamondCell) {
    const below = cellAt(diamondCell.row - 1, diamondCell.col);
    if (below && below.color) {
      game.pendingDiamond = { type: 'TRIGGER', row: diamondCell.row, col: diamondCell.col, color: below.color };
    } else {
      game.pendingDiamond = { type: 'TECH', row: diamondCell.row, col: diamondCell.col };
    }
  }

  game.pressure.meter += PRESSURE_PER_LOCK;

  game.active = null;
  game.state = GameState.RESOLVE;
  game.resolve = {
    chainIndex: 1,
    resolved: false,
    settling: true,
    settleTimer: 0,
    techHandled: false,
  };
}

function handleHorizontalRepeat(dt) {
  const held = game.input.held;
  if (held.left && !held.right) {
    game.repeat.left += dt;
    while (game.repeat.left >= 0) {
      if (tryMovePiece(0, -1)) {
        sfx.play(BANK_PUZZLEPUNCHER, 'move');
      }
      game.repeat.left -= ARR;
    }
  } else {
    game.repeat.left = -DAS;
  }

  if (held.right && !held.left) {
    game.repeat.right += dt;
    while (game.repeat.right >= 0) {
      if (tryMovePiece(0, 1)) {
        sfx.play(BANK_PUZZLEPUNCHER, 'move');
      }
      game.repeat.right -= ARR;
    }
  } else {
    game.repeat.right = -DAS;
  }
}

function isGrounded(piece) {
  if (!piece) return false;
  const oneDown = pieceCells(piece).map((cell) => ({ row: cell.row - 1, col: cell.col }));
  return !canPlace(oneDown);
}

function stepFalling(dt) {
  if (!game.active) {
    game.state = GameState.SPAWN;
    return;
  }

  if (game.input.pressed.rotateCW) {
    if (tryRotate(1)) {
      sfx.play(BANK_PUZZLEPUNCHER, 'rotate');
    }
  }
  if (game.input.pressed.rotateCCW) {
    if (tryRotate(-1)) {
      sfx.play(BANK_PUZZLEPUNCHER, 'rotate');
    }
  }

  if (game.input.pressed.hardDrop) {
    let guard = 0;
    while (tryMovePiece(-1, 0) && guard < H) {
      guard += 1;
    }
    if (guard > 0) {
      sfx.play(BANK_PUZZLEPUNCHER, 'hardDrop');
    }
    lockPiece();
    return;
  }

  handleHorizontalRepeat(dt);

  const interval = currentGravityInterval();
  game.timers.gravityElapsed += dt;
  while (game.timers.gravityElapsed >= interval) {
    if (!tryMovePiece(-1, 0)) {
      break;
    }
    game.timers.gravityElapsed -= interval;
  }

  if (isGrounded(game.active)) {
    game.active.lockTimer += dt;
    if (game.active.lockTimer >= LOCK_DELAY) {
      lockPiece();
      return;
    }
  } else {
    game.active.lockTimer = 0;
  }
}

function applyGravity() {
  let moved = false;
  for (let c = 0; c < W; c++) {
    const column = [];
    for (let r = 0; r < H; r++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.EMPTY) {
        column.push(cell);
      }
    }
    for (let r = 0; r < H; r++) {
      const next = column[r] ? column[r] : makeEmptyCell();
      if (next.kind !== game.board.cells[r][c].kind || next.color !== game.board.cells[r][c].color) {
        moved = true;
      }
      game.board.cells[r][c] = next;
    }
  }
  return moved;
}

function settleOnce() {
  let moved = false;
  for (let r = 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind === Kind.EMPTY) continue;
      if (game.board.cells[r - 1][c].kind !== Kind.EMPTY) continue;
      game.board.cells[r - 1][c] = cell;
      game.board.cells[r - 1][c].bounce = Math.max(game.board.cells[r - 1][c].bounce, 0.8);
      game.board.cells[r][c] = makeEmptyCell();
      moved = true;
    }
  }
  if (moved) {
    // Keep power-gem identity stable while the board is settling.
    // This avoids brief visual reversion to individual blocks.
    markPowerRects();
  }
  return moved;
}

function clearPowerRects() {
  game.powerRects.clear();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c].powerRectId = 0;
    }
  }
}

function markPowerRects() {
  clearPowerRects();
  const used = Array.from({ length: H }, () => Array(W).fill(false));
  const candidates = [];

  for (const color of COLORS) {
    for (let r0 = 0; r0 < H - 1; r0++) {
      for (let c0 = 0; c0 < W - 1; c0++) {
        for (let r1 = r0 + 1; r1 < H; r1++) {
          for (let c1 = c0 + 1; c1 < W; c1++) {
            let full = true;
            for (let r = r0; r <= r1; r++) {
              for (let c = c0; c <= c1; c++) {
                const cell = game.board.cells[r][c];
                if (cell.kind !== Kind.NORMAL || cell.color !== color) {
                  full = false;
                  r = r1;
                  break;
                }
              }
            }
            if (full) {
              candidates.push({
                area: (r1 - r0 + 1) * (c1 - c0 + 1),
                r0,
                c0,
                r1,
                c1,
                color,
              });
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area;
    const ah = a.r1 - a.r0;
    const bh = b.r1 - b.r0;
    if (bh !== ah) return bh - ah;
    return a.c0 - b.c0;
  });

  let rectId = 1;
  for (const rect of candidates) {
    let overlap = false;
    for (let r = rect.r0; r <= rect.r1 && !overlap; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        if (used[r][c]) {
          overlap = true;
          break;
        }
      }
    }
    if (overlap) continue;

    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        used[r][c] = true;
        game.board.cells[r][c].powerRectId = rectId;
      }
    }
    game.powerRects.set(rectId, rect);
    rectId += 1;
  }
}

function findCrashTriggers() {
  const triggers = [];
  const seen = new Set();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.CRASH || !cell.color) continue;
      const neighbors = [
        { row: r + 1, col: c },
        { row: r - 1, col: c },
        { row: r, col: c + 1 },
        { row: r, col: c - 1 },
      ];
      for (const n of neighbors) {
        if (!inBounds(n.row, n.col)) continue;
        const other = game.board.cells[n.row][n.col];
        // Counter/garbage gems are not direct crash targets; they pop only when adjacent
        // to another clear event or when converted to normal gems.
        if (other.kind !== Kind.EMPTY && other.kind !== Kind.GARBAGE && other.color === cell.color) {
          const key = `${r},${c}`;
          if (!seen.has(key)) {
            triggers.push({ row: r, col: c, color: cell.color });
            seen.add(key);
          }
          break;
        }
      }
    }
  }
  return triggers;
}

function collectCrashClear(triggers) {
  const toClear = new Set();
  for (const trigger of triggers) {
    const stack = [{ row: trigger.row, col: trigger.col }];
    while (stack.length) {
      const current = stack.pop();
      const key = `${current.row},${current.col}`;
      if (toClear.has(key)) continue;
      const cell = game.board.cells[current.row][current.col];
      if (cell.kind === Kind.EMPTY || cell.color !== trigger.color || cell.kind === Kind.GARBAGE) continue;
      toClear.add(key);
      const neighbors = [
        { row: current.row + 1, col: current.col },
        { row: current.row - 1, col: current.col },
        { row: current.row, col: current.col + 1 },
        { row: current.row, col: current.col - 1 },
      ];
      for (const n of neighbors) {
        if (inBounds(n.row, n.col)) {
          stack.push(n);
        }
      }
    }
  }
  addAdjacentGarbage(toClear);
  return toClear;
}

function collectColorClear(color, diamondCell) {
  const toClear = new Set();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.EMPTY && cell.color === color) {
        toClear.add(`${r},${c}`);
      }
    }
  }
  if (diamondCell) {
    toClear.add(`${diamondCell.row},${diamondCell.col}`);
  }
  return toClear;
}

function addAdjacentGarbage(toClear) {
  const extraGarbage = [];
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const neighbors = [
      { row: r + 1, col: c },
      { row: r - 1, col: c },
      { row: r, col: c + 1 },
      { row: r, col: c - 1 },
    ];
    for (const n of neighbors) {
      if (!inBounds(n.row, n.col)) continue;
      const near = game.board.cells[n.row][n.col];
      if (near.kind === Kind.GARBAGE) {
        extraGarbage.push(`${n.row},${n.col}`);
      }
    }
  }
  for (const key of extraGarbage) {
    toClear.add(key);
  }
}

function countClearCells(toClear) {
  const counts = { normal: 0, crash: 0, power: 0, diamond: 0, garbage: 0 };
  const colors = new Set();
  const powerRectSizes = new Map();
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const cell = game.board.cells[r][c];
    if (cell.kind === Kind.CRASH) {
      counts.crash += 1;
      if (cell.color) colors.add(cell.color);
    } else if (cell.kind === Kind.DIAMOND) {
      counts.diamond += 1;
    } else if (cell.kind === Kind.GARBAGE) {
      counts.garbage += 1;
    } else if (cell.kind === Kind.NORMAL) {
      if (cell.color) colors.add(cell.color);
      if (cell.powerRectId > 0) {
        counts.power += 1;
        powerRectSizes.set(cell.powerRectId, (powerRectSizes.get(cell.powerRectId) ?? 0) + 1);
      } else {
        counts.normal += 1;
      }
    }
  }
  counts.totalColored = counts.normal + counts.crash + counts.power;
  counts.colorVariety = colors.size;
  counts.largestPowerRect = 0;
  for (const size of powerRectSizes.values()) {
    if (size > counts.largestPowerRect) counts.largestPowerRect = size;
  }
  return counts;
}

function clearCells(toClear) {
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    game.board.cells[r][c] = makeEmptyCell();
  }
}

function chainBonusFor(chainIndex) {
  if (chainIndex <= CHAIN_BONUS_TABLE.length) {
    return CHAIN_BONUS_TABLE[Math.max(0, chainIndex - 1)];
  }
  return CHAIN_BONUS_TABLE[CHAIN_BONUS_TABLE.length - 1] + (chainIndex - CHAIN_BONUS_TABLE.length) * 32;
}

function sizeBonusFor(totalColored) {
  if (totalColored < SIZE_BONUS_TABLE.length) return SIZE_BONUS_TABLE[totalColored];
  return SIZE_BONUS_TABLE[SIZE_BONUS_TABLE.length - 1] + (totalColored - (SIZE_BONUS_TABLE.length - 1)) * 3;
}

function scoreEvent(counts, chainIndex, isDiamond) {
  const base =
    SCORE.NORMAL * counts.normal +
    SCORE.CRASH * counts.crash +
    SCORE.POWER * counts.power +
    SCORE.GARBAGE * counts.garbage +
    SCORE.NORMAL * counts.diamond;

  const chainBonus = chainBonusFor(chainIndex);
  const clearSizeBonus = sizeBonusFor(counts.totalColored);
  const colorBonus = Math.max(0, counts.colorVariety - 1) * 3;
  const powerSizeBonus = counts.largestPowerRect >= 4
    ? 4 + Math.floor((counts.largestPowerRect - 4) * 1.5)
    : 0;
  const multiplier = Math.max(1, chainBonus + clearSizeBonus + colorBonus + powerSizeBonus);

  let score = Math.round(base * multiplier);
  if (isDiamond) score = Math.round(score * 0.9);
  game.score += score;
  const chainLabel = chainIndex >= 2 ? `Chain ${chainIndex}` : 'Clear';
  game.status = `${chainLabel} +${score} (x${multiplier})`;
}

function isBoardEmpty() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (game.board.cells[r][c].kind !== Kind.EMPTY) return false;
    }
  }
  return true;
}

function addBanner(text, life = 700) {
  game.fx.banners.push({ text, life, ttl: life });
}

function triggerClearFx(total, chainIndex) {
  game.fx.hitstop = Math.max(game.fx.hitstop, chainIndex >= 2 ? 75 : 45);
  game.fx.shake = Math.min(14, game.fx.shake + 2 + chainIndex * 1.4 + total * 0.1);
  game.fx.waves.push({
    cx: view.boardLeft + view.boardWidth / 2,
    cy: view.boardTop + view.boardHeight / 2,
    life: 420,
    ttl: 420,
    maxR: 190,
  });
  const particleCount = Math.min(50, 8 + total * 3 + chainIndex * 4);
  for (let i = 0; i < particleCount; i++) {
    const ang = game.rng.next() * Math.PI * 2;
    const speed = 0.03 + game.rng.next() * 0.12;
    game.fx.particles.push({
      x: view.boardLeft + view.boardWidth * (0.2 + game.rng.next() * 0.6),
      y: view.boardTop + view.boardHeight * (0.2 + game.rng.next() * 0.6),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 420 + game.rng.int(240),
      ttl: 420 + game.rng.int(240),
      size: 2 + game.rng.next() * 3,
      color: ['#ffffff', '#facc15', '#93c5fd', '#fecaca'][game.rng.int(4)],
    });
  }
  if (chainIndex >= 2) addBanner(`${chainIndex} CHAIN`);
}

function stackDangerLevel() {
  let maxRow = -1;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (game.board.cells[r][c].kind !== Kind.EMPTY && r > maxRow) maxRow = r;
    }
  }
  if (maxRow < 8) return 0;
  return Math.min(1, (maxRow - 8) / 4);
}

function schedulePressure(dt) {
  const p = game.pressure;
  if (game.pieceIndex < 10) return;
  const interval = Math.max(7200, PRESSURE_INTERVAL_BASE - (game.level - 1) * 180);
  p.waveTimer += dt;
  while (p.waveTimer >= interval) {
    p.waveTimer -= interval;
    p.pendingRows += 1 + Math.floor((game.level - 1) / 10);
    p.meter += PRESSURE_WAVE_STRENGTH;
  }
  p.meter = Math.max(0, p.meter - dt * 0.00003);
}

function tickGarbageCounters() {
  let converted = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.GARBAGE) continue;
      const nextCounter = (cell.counter ?? 0) - 1;
      cell.counter = nextCounter;
      if (nextCounter <= 0) {
        cell.kind = Kind.NORMAL;
        cell.counter = 0;
        cell.bounce = Math.max(cell.bounce, 1);
        converted += 1;
      }
    }
  }
  if (converted >= 4) {
    addBanner('COUNTER BREAK', 560);
  }
}

function setGameOver(msg) {
  game.state = GameState.GAME_OVER;
  game.status = msg || 'Game over. Press R to restart.';
  sfx.play(BANK_PUZZLEPUNCHER, 'gameOver');
}

function applyGarbageRows(rows) {
  if (rows <= 0 || game.state === GameState.GAME_OVER) return;
  const gemsToDrop = rows * Math.max(2, W - 1);
  for (let i = 0; i < gemsToDrop; i++) {
    const spawnableCols = [];
    for (let c = 0; c < W; c++) {
      if (game.board.cells[H - 1][c].kind === Kind.EMPTY) {
        spawnableCols.push(c);
      }
    }
    if (spawnableCols.length === 0) {
      setGameOver('Crushed by pressure. Press R to restart.');
      return;
    }

    const col = spawnableCols[game.rng.int(spawnableCols.length)];
    let row = H - 1;
    while (row > 0 && game.board.cells[row][col].kind !== Kind.EMPTY) {
      row -= 1;
    }
    if (game.board.cells[row][col].kind !== Kind.EMPTY) {
      setGameOver('Crushed by pressure. Press R to restart.');
      return;
    }

    const g = makeEmptyCell();
    g.kind = Kind.GARBAGE;
    g.color = COLORS[game.rng.int(COLORS.length)];
    // SPF-style counter gems are timed from 5 and tick down once per lock.
    g.counter = 5;
    g.face = game.rng.int(4);
    g.shine = game.rng.next();
    g.bounce = 1;
    game.board.cells[row][col] = g;
  }

  // Recompute immediately so existing power-gems remain merged visually unless
  // their shape was actually broken by movement.
  markPowerRects();
  game.fx.shake = Math.min(16, game.fx.shake + 3 + rows * 1.2);
  addBanner(`+${gemsToDrop} COUNTER`, 560);
  game.status = `Pressure drop: ${gemsToDrop} counter gems`;
  sfx.play(BANK_PUZZLEPUNCHER, 'garbageRise');
}

function applyPressureRelief(counts, chainIndex) {
  const total = counts.normal + counts.crash + counts.power + counts.diamond + counts.garbage;
  const relief = 0.4 + total * 0.055 + Math.max(0, chainIndex - 1) * 0.55 + counts.power * 0.02;
  game.pressure.meter = Math.max(0, game.pressure.meter - relief);
  const canceled = Math.floor(relief / 1.15);
  if (canceled > 0) {
    game.pressure.pendingRows = Math.max(0, game.pressure.pendingRows - canceled);
  }
}

function resolveBoard(dt) {
  const resolve = game.resolve || {
    chainIndex: 1,
    resolved: false,
    settling: false,
    settleTimer: 0,
    techHandled: false,
  };

  if (!resolve.techHandled && game.pendingDiamond && game.pendingDiamond.type === 'TECH') {
    const { row, col } = game.pendingDiamond;
    if (inBounds(row, col)) {
      game.board.cells[row][col] = makeEmptyCell();
    }
    game.score += SCORE.TECH;
    game.status = `Tech bonus +${SCORE.TECH}`;
    sfx.play(BANK_PUZZLEPUNCHER, 'techBonus');
    addBanner('TECH HIT', 660);
    game.pendingDiamond = null;
    resolve.techHandled = true;
    resolve.settling = true;
    resolve.settleTimer = 0;
    clearPowerRects();
    game.resolve = resolve;
    return;
  }

  if (resolve.settling) {
    resolve.settleTimer += dt;
    while (resolve.settleTimer >= RESOLVE_DROP_INTERVAL) {
      const moved = settleOnce();
      resolve.settleTimer -= RESOLVE_DROP_INTERVAL;
      if (!moved) {
        resolve.settling = false;
        break;
      }
    }
    game.resolve = resolve;
    if (resolve.settling) return;
  }

  markPowerRects();

  if (game.pendingDiamond && game.pendingDiamond.type === 'TRIGGER') {
    const toClear = collectColorClear(game.pendingDiamond.color, game.pendingDiamond);
    const counts = countClearCells(toClear);
    clearCells(toClear);
    clearPowerRects();
    const totalCleared = counts.normal + counts.crash + counts.power + counts.diamond + counts.garbage;
    const chainIndex = resolve.chainIndex;
    if (chainIndex >= 2) {
      sfx.play(BANK_PUZZLEPUNCHER, 'chain', { chain: chainIndex, chainIndex });
    }
    if (counts.power > 0) {
      sfx.play(BANK_PUZZLEPUNCHER, 'power', { power: counts.power, cleared: totalCleared });
    }
    sfx.play(BANK_PUZZLEPUNCHER, 'diamond', { cleared: totalCleared, chain: chainIndex, chainIndex });
    sfx.play(BANK_PUZZLEPUNCHER, 'clear', { cleared: totalCleared, chain: chainIndex, chainIndex });
    scoreEvent(counts, chainIndex, true);
    triggerClearFx(totalCleared, chainIndex);
    applyPressureRelief(counts, chainIndex);
    game.pendingDiamond = null;
    resolve.resolved = true;
    resolve.chainIndex += 1;
    resolve.settling = true;
    resolve.settleTimer = 0;
    game.resolve = resolve;
    return;
  }

  const triggers = findCrashTriggers();
  if (triggers.length > 0) {
    const toClear = collectCrashClear(triggers);
    const counts = countClearCells(toClear);
    clearCells(toClear);
    clearPowerRects();
    const totalCleared = counts.normal + counts.crash + counts.power + counts.diamond + counts.garbage;
    const chainIndex = resolve.chainIndex;
    if (chainIndex >= 2) {
      sfx.play(BANK_PUZZLEPUNCHER, 'chain', { chain: chainIndex, chainIndex });
    }
    if (counts.power > 0) {
      sfx.play(BANK_PUZZLEPUNCHER, 'power', { power: counts.power, cleared: totalCleared });
    }
    sfx.play(BANK_PUZZLEPUNCHER, 'clear', { cleared: totalCleared, chain: chainIndex, chainIndex });
    scoreEvent(counts, chainIndex, false);
    triggerClearFx(totalCleared, chainIndex);
    applyPressureRelief(counts, chainIndex);
    resolve.resolved = true;
    resolve.chainIndex += 1;
    resolve.settling = true;
    resolve.settleTimer = 0;
    game.resolve = resolve;
    return;
  }

  game.lastChain = resolve.resolved ? resolve.chainIndex - 1 : 0;
  if (game.lastChain < 2) {
    game.lastChain = 0;
  }

  if (resolve.resolved && isBoardEmpty()) {
    game.score += SCORE.ALL_CLEAR;
    game.status = `All clear +${SCORE.ALL_CLEAR}`;
    sfx.play(BANK_PUZZLEPUNCHER, 'allClear');
    addBanner('ALL CLEAR', 900);
    game.pressure.meter = Math.max(0, game.pressure.meter - 2.2);
    game.pressure.pendingRows = Math.max(0, game.pressure.pendingRows - 2);
  }

  if (game.pressure.pendingRows > 0) {
    const amount = Math.min(1, game.pressure.pendingRows);
    game.pressure.pendingRows -= amount;
    applyGarbageRows(amount);
    if (game.state === GameState.GAME_OVER) return;
    // Let newly dropped counter gems physically settle before the next spawn.
    resolve.settling = true;
    resolve.settleTimer = 0;
    game.resolve = resolve;
    return;
  }

  game.state = GameState.SPAWN;
  game.resolve = null;
}

function updateCellAnimations(dt) {
  const d = dt * 0.005;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind === Kind.EMPTY) continue;
      cell.bounce = Math.max(0, cell.bounce - d);
      cell.shine += dt * 0.0001;
      if (cell.shine > 1) cell.shine -= 1;
    }
  }
}

function updateFx(dt) {
  game.fx.phase += dt * 0.00016;
  if (game.fx.phase > 1) game.fx.phase -= 1;
  game.fx.shake = Math.max(0, game.fx.shake - dt * 0.02);
  game.fx.hitstop = Math.max(0, game.fx.hitstop - dt);

  for (let i = game.fx.particles.length - 1; i >= 0; i--) {
    const p = game.fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      game.fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.00009 * dt;
  }

  for (let i = game.fx.waves.length - 1; i >= 0; i--) {
    const w = game.fx.waves[i];
    w.life -= dt;
    if (w.life <= 0) game.fx.waves.splice(i, 1);
  }

  for (let i = game.fx.banners.length - 1; i >= 0; i--) {
    const b = game.fx.banners[i];
    b.life -= dt;
    if (b.life <= 0) game.fx.banners.splice(i, 1);
  }

  const danger = stackDangerLevel();
  if (danger >= 0.7 && !game.paused && game.state !== GameState.GAME_OVER) {
    game.fx.warningTimer += dt;
    if (game.fx.warningTimer >= 850) {
      game.fx.warningTimer = 0;
      sfx.play(BANK_PUZZLEPUNCHER, 'warning');
    }
  } else {
    game.fx.warningTimer = 0;
  }
}

function stepGame(dt) {
  updateFx(dt);
  updateCellAnimations(dt);

  if (game.state === GameState.GAME_OVER) {
    game.input.clearPressed();
    return;
  }
  if (game.paused) {
    game.input.clearPressed();
    return;
  }

  schedulePressure(dt);
  if (game.fx.hitstop > 0) {
    game.input.clearPressed();
    return;
  }

  if (game.state === GameState.SPAWN) {
    spawnPiece();
  } else if (game.state === GameState.FALLING) {
    stepFalling(dt);
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard(dt);
  }

  game.input.clearPressed();
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  chainEl.textContent = game.lastChain >= 2 ? `${game.lastChain}x` : '-';
  levelEl.textContent = game.level.toString();
  piecesEl.textContent = game.pieceIndex.toString();
  pressureEl.textContent = game.pressure.meter.toFixed(1);
  statusEl.textContent = game.paused ? 'Paused' : game.status;
}

function setupView() {
  view.boardWidth = W * view.cellSize;
  view.boardHeight = H * view.cellSize;
  view.boardLeft = Math.floor((canvas.width - view.boardWidth) / 2);
  view.boardTop = Math.floor((canvas.height - view.boardHeight) / 2);
  view.colX = Array.from({ length: W }, (_, c) => view.boardLeft + c * view.cellSize);
  view.rowY = Array.from({ length: H }, (_, r) => view.boardTop + (H - 1 - r) * view.cellSize);
  view.boardBgGrad = ctx.createLinearGradient(
    view.boardLeft,
    view.boardTop,
    view.boardLeft,
    view.boardTop + view.boardHeight
  );
  view.boardBgGrad.addColorStop(0, '#0b2b1f');
  view.boardBgGrad.addColorStop(1, '#071b13');
  if (!view.staticLayer) {
    view.staticLayer = document.createElement('canvas');
    view.staticCtx = view.staticLayer.getContext('2d');
  }
  view.staticLayer.width = canvas.width;
  view.staticLayer.height = canvas.height;
  view.staticDirty = true;
  rebuildStaticBoardLayer();
}

function cellToX(col) {
  return view.boardLeft + col * view.cellSize;
}

function cellToY(row) {
  return view.boardTop + (H - 1 - row) * view.cellSize;
}

function rebuildStaticBoardLayer() {
  if (!view.staticCtx) return;
  const sctx = view.staticCtx;
  sctx.clearRect(0, 0, view.staticLayer.width, view.staticLayer.height);

  sctx.fillStyle = view.boardBgGrad;
  roundRect(sctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  sctx.fill();

  sctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  sctx.lineWidth = 2;
  roundRect(sctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  sctx.stroke();

  sctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  sctx.lineWidth = 1;
  for (let c = 1; c < W; c++) {
    const x = view.boardLeft + c * view.cellSize;
    sctx.beginPath();
    sctx.moveTo(x, view.boardTop);
    sctx.lineTo(x, view.boardTop + view.boardHeight);
    sctx.stroke();
  }
  for (let r = 1; r < H; r++) {
    const y = view.boardTop + r * view.cellSize;
    sctx.beginPath();
    sctx.moveTo(view.boardLeft, y);
    sctx.lineTo(view.boardLeft + view.boardWidth, y);
    sctx.stroke();
  }

  sctx.save();
  sctx.globalAlpha = 0.35;
  sctx.fillStyle = '#000000';
  sctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.cellSize);
  sctx.restore();

  sctx.save();
  sctx.globalAlpha = 0.12;
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(
    view.boardLeft + SPAWN_COL * view.cellSize,
    view.boardTop,
    view.cellSize,
    view.cellSize
  );
  sctx.restore();

  view.staticDirty = false;
}

function drawCell(ctxRef, cell, col, row) {
  const x = cellToX(col);
  const yBase = cellToY(row);
  const s = view.cellSize;
  const bounceOffset = Math.sin((1 - cell.bounce) * Math.PI) * cell.bounce * 5;
  const y = yBase - bounceOffset;
  if (cell.kind === Kind.DIAMOND) {
    drawDiamond(ctxRef, x, y, s);
    return;
  }
  if (cell.kind === Kind.GARBAGE) {
    const tintPalette = PALETTE[cell.color] || PALETTE.X;
    drawGemFill(ctxRef, x, y, s, tintPalette, {
      face: true,
      faceVariant: cell.face,
      shinePhase: cell.shine + game.fx.phase,
    });
    // Counter gems should read as gray while still hinting their hidden color.
    ctxRef.save();
    ctxRef.globalAlpha = 0.48;
    ctxRef.fillStyle = '#6b7280';
    roundRect(ctxRef, x + 1, y + 1, s - 2, s - 2, s * 0.2);
    ctxRef.fill();
    ctxRef.restore();
    drawGemBorder(ctxRef, x, y, s, PALETTE.X.stroke);
    drawGarbageOverlay(ctxRef, x, y, s);
    drawCounterNumber(ctxRef, x, y, s, cell.counter ?? 0);
    return;
  }
  if (!cell.color) return;
  const palette = PALETTE[cell.color];
  if (cell.powerRectId > 0) {
    const powerPalette = {
      base: palette.light,
      light: '#ffffff',
      dark: palette.base,
      stroke: palette.stroke,
    };
    drawGemFill(ctxRef, x, y, s, powerPalette, {
      highlight: false,
    });
    const edges = {
      top: !(row < H - 1 && game.board.cells[row + 1][col].powerRectId === cell.powerRectId),
      bottom: !(row > 0 && game.board.cells[row - 1][col].powerRectId === cell.powerRectId),
      left: !(col > 0 && game.board.cells[row][col - 1].powerRectId === cell.powerRectId),
      right: !(col < W - 1 && game.board.cells[row][col + 1].powerRectId === cell.powerRectId),
    };
    drawPowerEdges(ctxRef, x, y, s, edges, palette.stroke);
  } else {
    drawGemFill(ctxRef, x, y, s, palette, {
      face: true,
      faceVariant: cell.face,
      shinePhase: cell.shine + game.fx.phase,
    });
    drawGemBorder(ctxRef, x, y, s, palette.stroke);
  }
  if (cell.kind === Kind.CRASH) {
    drawCrashOverlay(ctxRef, x, y, s);
  }
}

function drawPowerRectsComposite() {
  if (!game.powerRects || game.powerRects.size === 0) return;
  const s = view.cellSize;
  for (const rect of game.powerRects.values()) {
    const palette = PALETTE[rect.color];
    if (!palette) continue;
    const x = cellToX(rect.c0);
    const y = cellToY(rect.r1);
    const w = (rect.c1 - rect.c0 + 1) * s;
    const h = (rect.r1 - rect.r0 + 1) * s;
    drawPowerRectGloss(ctx, x, y, w, h, palette, game.fx.phase);
  }
}

function drawEffects() {
  for (const wave of game.fx.waves) {
    const t = 1 - wave.life / wave.ttl;
    const radius = wave.maxR * t;
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.42 * (1 - t)})`;
    ctx.lineWidth = 2 + 4 * (1 - t);
    ctx.beginPath();
    ctx.arc(wave.cx, wave.cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of game.fx.particles) {
    const a = Math.max(0, p.life / p.ttl);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  }

  const danger = stackDangerLevel();
  if (danger > 0) {
    const pulse = 0.55 + 0.45 * Math.sin(game.fx.phase * Math.PI * 16);
    ctx.save();
    ctx.fillStyle = `rgba(239, 68, 68, ${danger * 0.18 * pulse})`;
    ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);
    ctx.restore();
  }

  for (const b of game.fx.banners) {
    const t = 1 - b.life / b.ttl;
    const alpha = t < 0.2 ? t / 0.2 : (1 - t) / 0.8;
    const y = view.boardTop + view.boardHeight * (0.42 - t * 0.1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(7, 11, 20, 0.75)';
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 30px Trebuchet MS, Segoe UI, sans-serif';
    ctx.strokeText(b.text, view.boardLeft + view.boardWidth / 2, y);
    ctx.fillText(b.text, view.boardLeft + view.boardWidth / 2, y);
    ctx.restore();
  }
}

function drawBoard(alpha) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const shakeX = (game.rng.next() * 2 - 1) * game.fx.shake;
  const shakeY = (game.rng.next() * 2 - 1) * game.fx.shake * 0.7;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  if (view.staticDirty) rebuildStaticBoardLayer();
  if (view.staticLayer) ctx.drawImage(view.staticLayer, 0, 0);

  for (let r = 0; r < H; r++) {
    const y = view.rowY[r];
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind === Kind.EMPTY) continue;
      const overflow = r >= VISIBLE_H;
      if (overflow) ctx.globalAlpha = 0.6;
      const x = view.colX[c];
      const s = view.cellSize;
      const bounceOffset = Math.sin((1 - cell.bounce) * Math.PI) * cell.bounce * 5;
      const yCell = y - bounceOffset;
      if (cell.kind === Kind.DIAMOND) {
        drawDiamond(ctx, x, yCell, s);
      } else if (cell.kind === Kind.GARBAGE) {
        const tintPalette = PALETTE[cell.color] || PALETTE.X;
        drawGemFill(ctx, x, yCell, s, tintPalette, {
          face: true,
          faceVariant: cell.face,
          shinePhase: cell.shine + game.fx.phase,
        });
        ctx.save();
        ctx.globalAlpha = 0.48;
        ctx.fillStyle = '#6b7280';
        roundRect(ctx, x + 1, yCell + 1, s - 2, s - 2, s * 0.2);
        ctx.fill();
        ctx.restore();
        drawGemBorder(ctx, x, yCell, s, PALETTE.X.stroke);
        drawGarbageOverlay(ctx, x, yCell, s);
        drawCounterNumber(ctx, x, yCell, s, cell.counter ?? 0);
      } else if (cell.color) {
        const palette = PALETTE[cell.color];
        if (cell.powerRectId > 0) {
          const powerPalette = {
            base: palette.light,
            light: '#ffffff',
            dark: palette.base,
            stroke: palette.stroke,
          };
          drawGemFill(ctx, x, yCell, s, powerPalette, { highlight: false });
          const edges = {
            top: !(r < H - 1 && game.board.cells[r + 1][c].powerRectId === cell.powerRectId),
            bottom: !(r > 0 && game.board.cells[r - 1][c].powerRectId === cell.powerRectId),
            left: !(c > 0 && game.board.cells[r][c - 1].powerRectId === cell.powerRectId),
            right: !(c < W - 1 && game.board.cells[r][c + 1].powerRectId === cell.powerRectId),
          };
          drawPowerEdges(ctx, x, yCell, s, edges, palette.stroke);
        } else {
          drawGemFill(ctx, x, yCell, s, palette, {
            face: true,
            faceVariant: cell.face,
            shinePhase: cell.shine + game.fx.phase,
          });
          drawGemBorder(ctx, x, yCell, s, palette.stroke);
        }
        if (cell.kind === Kind.CRASH) drawCrashOverlay(ctx, x, yCell, s);
      }
      if (overflow) ctx.globalAlpha = 1;
    }
  }
  drawPowerRectsComposite();

  if (game.active) {
    const fallAlpha = getFallAlpha(alpha);
    const cells = pieceCells(game.active);
    for (const cell of cells) {
      const x = cellToX(cell.col);
      const y = cellToY(cell.row) + fallAlpha * view.cellSize;
      const s = view.cellSize;
      if (cell.gem.kind === Kind.DIAMOND) {
        drawDiamond(ctx, x, y, s);
      } else {
        const palette = PALETTE[cell.gem.color];
        drawGemFill(ctx, x, y, s, palette, {
          face: true,
          faceVariant: (cell.row + cell.col) & 3,
          shinePhase: game.fx.phase,
        });
        drawGemBorder(ctx, x, y, s, palette.stroke);
        if (cell.gem.kind === Kind.CRASH) {
          drawCrashOverlay(ctx, x, y, s);
        }
      }
    }
  }

  if (game.paused || game.state === GameState.GAME_OVER) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 22px Trebuchet MS, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = game.state === GameState.GAME_OVER ? 'Game Over' : 'Paused';
    ctx.fillText(label, view.boardLeft + view.boardWidth / 2, view.boardTop + view.boardHeight / 2);
    ctx.restore();
  }

  drawEffects();
  ctx.restore();
}

function drawPreviewPiece(ctxRef, canvasRef, spec) {
  ctxRef.clearRect(0, 0, canvasRef.width, canvasRef.height);
  if (!spec) return;
  const size = 32;
  const centerX = canvasRef.width / 2;
  const centerY = canvasRef.height / 2 + 8;
  const gems = [{ gem: spec.a, idx: 0 }, { gem: spec.b, idx: 1 }];
  gems.forEach((item, i) => {
    const x = centerX - size / 2;
    const y = centerY - size / 2 - i * size;
    if (item.gem.kind === Kind.DIAMOND) {
      drawDiamond(ctxRef, x, y, size);
    } else {
      const palette = PALETTE[item.gem.color];
      drawGemFill(ctxRef, x, y, size, palette, {
        face: true,
        faceVariant: (item.idx + i) & 3,
        shinePhase: game.fx.phase,
      });
      drawGemBorder(ctxRef, x, y, size, palette.stroke);
      if (item.gem.kind === Kind.CRASH) drawCrashOverlay(ctxRef, x, y, size);
    }
  });
}

function drawNextPiece() {
  drawPreviewPiece(nextCtx, nextCanvas, game.queue[0]);
  drawPreviewPiece(next2Ctx, next2Canvas, game.queue[1]);
}

function getFallAlpha(alpha) {
  if (!game.active || game.state !== GameState.FALLING) return 0;
  const interval = currentGravityInterval();
  if (!canPlace(pieceCells(game.active).map((cell) => ({
    row: cell.row - 1,
    col: cell.col,
  })))) {
    return 0;
  }
  const blend = alpha === undefined ? 0 : alpha;
  const t = Math.min(1, (game.timers.gravityElapsed + blend * FIXED_DT) / interval);
  return t;
}

function draw(alpha) {
  drawBoard(alpha);
  drawNextPiece();
  updateHud();
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
  const key = ev.key.toLowerCase();
  if (ev.repeat) {
    if (key === 'arrowdown') {
      ev.preventDefault();
    }
    return;
  }
  unlockAudio();
  if (key === 'arrowleft' || key === 'a') {
    if (!game.input.held.left) {
      game.input.held.left = true;
      if (tryMovePiece(0, -1)) {
        sfx.play(BANK_PUZZLEPUNCHER, 'move');
      }
      game.repeat.left = -DAS;
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      if (tryMovePiece(0, 1)) {
        sfx.play(BANK_PUZZLEPUNCHER, 'move');
      }
      game.repeat.right = -DAS;
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowdown' || key === 's') {
    game.input.held.down = true;
    ev.preventDefault();
    return;
  }
  if (key === 'arrowup' || key === 'x') {
    game.input.pressed.rotateCW = true;
    ev.preventDefault();
    return;
  }
  if (key === 'z' || key === 'q') {
    game.input.pressed.rotateCCW = true;
    ev.preventDefault();
    return;
  }
  if (key === ' ') {
    game.input.pressed.hardDrop = true;
    ev.preventDefault();
    return;
  }
  if (key === 'p') {
    togglePause();
    ev.preventDefault();
    return;
  }
  if (key === 'r') {
    newGame();
    ev.preventDefault();
  }
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function handleKeyUp(ev) {
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    game.input.held.left = false;
    game.repeat.left = -DAS;
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    game.input.held.right = false;
    game.repeat.right = -DAS;
    ev.preventDefault();
  }
  if (key === 'arrowdown' || key === 's') {
    game.input.held.down = false;
    ev.preventDefault();
  }
}

function togglePause() {
  if (game.state === GameState.GAME_OVER) return;
  const nextPaused = !game.paused;
  if (nextPaused) {
    game.statusBeforePause = game.status;
    game.status = 'Paused';
  } else {
    game.status = game.statusBeforePause || game.status;
  }
  game.paused = nextPaused;
  pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
}

function loop() {
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    acc += now - last;
    last = now;
    while (acc >= FIXED_DT) {
      stepGame(FIXED_DT);
      acc -= FIXED_DT;
    }
    draw(acc / FIXED_DT);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
pauseBtn.addEventListener('click', () => togglePause());
document.addEventListener('pointerdown', unlockAudio, { once: true });

setupView();
initGameShell({
  shellEl: '.puzzle-wrap',
  surfaceEl: '#puzzle-surface',
  canvasEl: canvas,
  baseWidth: canvas.width,
  baseHeight: canvas.height,

  mode: 'fractional',
  fit: 'css',
  onResize: setupView,
});
newGame();
loop();
