import { SfxEngine } from './sfx_engine.js';
import { BANK_PUZZLEPUNCHER } from './sfx_bank_puzzle_puncher.js';

const W = 6;
const H = 13;
const VISIBLE_H = 12;
const SPAWN_COL = 3;

const Kind = {
  EMPTY: 'EMPTY',
  NORMAL: 'NORMAL',
  CRASH: 'CRASH',
  DIAMOND: 'DIAMOND',
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
};

const SCORE = {
  NORMAL: 10,
  POWER: 25,
  TECH: 10000,
  ALL_CLEAR: 5000,
};

const DAS = 160;
const ARR = 60;
const FIXED_DT = 1000 / 60;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const chainEl = document.getElementById('chain');
const levelEl = document.getElementById('level');
const piecesEl = document.getElementById('pieces');
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
  return { kind: Kind.EMPTY, color: null, powerGroupId: 0 };
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
    nextSpec: null,
    pendingDiamond: null,
    pieceIndex: 0,
    level: 1,
    score: 0,
    lastChain: 0,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    timers: { gravityElapsed: 0 },
  };
}

function resetBoard() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c] = makeEmptyCell();
    }
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
  game.pendingDiamond = null;
  game.pieceIndex = 0;
  game.level = 1;
  game.score = 0;
  game.lastChain = 0;
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.timers.gravityElapsed = 0;
  game.nextSpec = rollPiece(game.rng, 1);
  pauseBtn.textContent = 'Pause';
}

function rollGem(rng) {
  const color = COLORS[rng.int(COLORS.length)];
  const isCrash = rng.int(6) === 0;
  return { kind: isCrash ? Kind.CRASH : Kind.NORMAL, color };
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
  return true;
}

function tryRotate(dir) {
  if (!game.active) return false;
  const nextOrient = (game.active.orient + dir + 4) & 3;
  const cells = pieceCells(game.active, nextOrient).map((cell) => ({
    row: cell.row,
    col: cell.col,
  }));
  if (!canPlace(cells)) return false;
  game.active.orient = nextOrient;
  return true;
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
  game.level = 1 + Math.floor(game.pieceIndex / 25);
  const spec = game.nextSpec || rollPiece(game.rng, game.pieceIndex);
  game.active = makeActivePiece(spec);
  game.nextSpec = rollPiece(game.rng, game.pieceIndex + 1);
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
    const next = makeEmptyCell();
    if (cell.gem.kind === Kind.DIAMOND) {
      next.kind = Kind.DIAMOND;
      next.color = null;
      diamondCell = { row: cell.row, col: cell.col };
    } else {
      next.kind = cell.gem.kind;
      next.color = cell.gem.color;
    }
    game.board.cells[cell.row][cell.col] = next;
  }

  game.pendingDiamond = null;
  if (diamondCell) {
    const below = cellAt(diamondCell.row - 1, diamondCell.col);
    if (below && below.color) {
      game.pendingDiamond = { type: 'TRIGGER', row: diamondCell.row, col: diamondCell.col, color: below.color };
    } else {
      game.pendingDiamond = { type: 'TECH', row: diamondCell.row, col: diamondCell.col };
    }
  }

  game.active = null;
  game.state = GameState.RESOLVE;
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
      lockPiece();
      return;
    }
    game.timers.gravityElapsed -= interval;
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

function clearPowerGroups() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c].powerGroupId = 0;
    }
  }
}

function markPowerGroups() {
  clearPowerGroups();
  const powerMask = Array.from({ length: H }, () => Array(W).fill(false));

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
              for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                  powerMask[r][c] = true;
                }
              }
            }
          }
        }
      }
    }
  }

  let groupId = 1;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (!powerMask[r][c] || cell.powerGroupId !== 0 || cell.kind !== Kind.NORMAL) continue;
      const color = cell.color;
      const stack = [{ row: r, col: c }];
      cell.powerGroupId = groupId;
      while (stack.length) {
        const current = stack.pop();
        const neighbors = [
          { row: current.row + 1, col: current.col },
          { row: current.row - 1, col: current.col },
          { row: current.row, col: current.col + 1 },
          { row: current.row, col: current.col - 1 },
        ];
        for (const n of neighbors) {
          if (!inBounds(n.row, n.col)) continue;
          const next = game.board.cells[n.row][n.col];
          if (!powerMask[n.row][n.col]) continue;
          if (next.kind !== Kind.NORMAL || next.color !== color) continue;
          if (next.powerGroupId !== 0) continue;
          next.powerGroupId = groupId;
          stack.push(n);
        }
      }
      groupId += 1;
    }
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
        if (other.kind !== Kind.EMPTY && other.color === cell.color) {
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
      if (cell.kind === Kind.EMPTY || cell.color !== trigger.color) continue;
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

function countClearCells(toClear) {
  const counts = { normal: 0, crash: 0, power: 0, diamond: 0 };
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const cell = game.board.cells[r][c];
    if (cell.kind === Kind.CRASH) {
      counts.crash += 1;
    } else if (cell.kind === Kind.DIAMOND) {
      counts.diamond += 1;
    } else if (cell.kind === Kind.NORMAL) {
      if (cell.powerGroupId > 0) counts.power += 1;
      else counts.normal += 1;
    }
  }
  return counts;
}

function clearCells(toClear) {
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    game.board.cells[r][c] = makeEmptyCell();
  }
}

function scoreEvent(counts, chainIndex, isDiamond) {
  const base =
    SCORE.NORMAL * (counts.normal + counts.crash + counts.diamond) +
    SCORE.POWER * counts.power;
  let score = Math.round(base * (1 + 0.5 * (chainIndex - 1)));
  if (isDiamond) score = Math.round(score * 0.8);
  game.score += score;
  const chainLabel = chainIndex >= 2 ? `Chain ${chainIndex}` : 'Clear';
  game.status = `${chainLabel} +${score}`;
}

function isBoardEmpty() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (game.board.cells[r][c].kind !== Kind.EMPTY) return false;
    }
  }
  return true;
}

function resolveBoard() {
  let chainIndex = 1;
  let resolved = false;

  if (game.pendingDiamond && game.pendingDiamond.type === 'TECH') {
    const { row, col } = game.pendingDiamond;
    if (inBounds(row, col)) {
      game.board.cells[row][col] = makeEmptyCell();
    }
    game.score += SCORE.TECH;
    game.status = `Tech bonus +${SCORE.TECH}`;
    sfx.play(BANK_PUZZLEPUNCHER, 'techBonus');
    game.pendingDiamond = null;
  }

  while (true) {
    applyGravity();
    markPowerGroups();

    if (game.pendingDiamond && game.pendingDiamond.type === 'TRIGGER') {
      const toClear = collectColorClear(game.pendingDiamond.color, game.pendingDiamond);
      const counts = countClearCells(toClear);
      clearCells(toClear);
      const totalCleared = counts.normal + counts.crash + counts.power + counts.diamond;
      if (chainIndex >= 2) {
        sfx.play(BANK_PUZZLEPUNCHER, 'chain', { chain: chainIndex, chainIndex });
      }
      if (counts.power > 0) {
        sfx.play(BANK_PUZZLEPUNCHER, 'power', { power: counts.power, cleared: totalCleared });
      }
      sfx.play(BANK_PUZZLEPUNCHER, 'diamond', { cleared: totalCleared, chain: chainIndex, chainIndex });
      sfx.play(BANK_PUZZLEPUNCHER, 'clear', { cleared: totalCleared, chain: chainIndex, chainIndex });
      scoreEvent(counts, chainIndex, true);
      game.pendingDiamond = null;
      resolved = true;
      chainIndex += 1;
      continue;
    }

    const triggers = findCrashTriggers();
    if (triggers.length > 0) {
      const toClear = collectCrashClear(triggers);
      const counts = countClearCells(toClear);
      clearCells(toClear);
      const totalCleared = counts.normal + counts.crash + counts.power + counts.diamond;
      if (chainIndex >= 2) {
        sfx.play(BANK_PUZZLEPUNCHER, 'chain', { chain: chainIndex, chainIndex });
      }
      if (counts.power > 0) {
        sfx.play(BANK_PUZZLEPUNCHER, 'power', { power: counts.power, cleared: totalCleared });
      }
      sfx.play(BANK_PUZZLEPUNCHER, 'clear', { cleared: totalCleared, chain: chainIndex, chainIndex });
      scoreEvent(counts, chainIndex, false);
      resolved = true;
      chainIndex += 1;
      continue;
    }

    break;
  }

  game.lastChain = chainIndex - 1;
  if (resolved && game.lastChain < 2) {
    game.lastChain = 0;
  }

  if (resolved && isBoardEmpty()) {
    game.score += SCORE.ALL_CLEAR;
    game.status = `All clear +${SCORE.ALL_CLEAR}`;
    sfx.play(BANK_PUZZLEPUNCHER, 'allClear');
  }

  game.state = GameState.SPAWN;
}

function stepGame(dt) {
  if (game.state === GameState.GAME_OVER) {
    game.input.clearPressed();
    return;
  }
  if (game.paused) {
    game.input.clearPressed();
    return;
  }

  if (game.state === GameState.SPAWN) {
    spawnPiece();
  } else if (game.state === GameState.FALLING) {
    stepFalling(dt);
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard();
  }

  game.input.clearPressed();
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  chainEl.textContent = game.lastChain >= 2 ? `${game.lastChain}x` : '-';
  levelEl.textContent = game.level.toString();
  piecesEl.textContent = game.pieceIndex.toString();
  statusEl.textContent = game.paused ? 'Paused' : game.status;
}

function setupView() {
  view.boardWidth = W * view.cellSize;
  view.boardHeight = H * view.cellSize;
  view.boardLeft = Math.floor((canvas.width - view.boardWidth) / 2);
  view.boardTop = Math.floor((canvas.height - view.boardHeight) / 2);
}

function cellToX(col) {
  return view.boardLeft + col * view.cellSize;
}

function cellToY(row) {
  return view.boardTop + (H - 1 - row) * view.cellSize;
}

function roundRect(ctxRef, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctxRef.beginPath();
  ctxRef.moveTo(x + radius, y);
  ctxRef.arcTo(x + w, y, x + w, y + h, radius);
  ctxRef.arcTo(x + w, y + h, x, y + h, radius);
  ctxRef.arcTo(x, y + h, x, y, radius);
  ctxRef.arcTo(x, y, x + w, y, radius);
  ctxRef.closePath();
}

function drawGemFill(ctxRef, x, y, s, palette) {
  const r = s * 0.2;
  const grad = ctxRef.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.5, palette.base);
  grad.addColorStop(1, palette.dark);
  ctxRef.fillStyle = grad;
  roundRect(ctxRef, x + 1, y + 1, s - 2, s - 2, r);
  ctxRef.fill();

  ctxRef.save();
  ctxRef.globalAlpha = 0.35;
  ctxRef.fillStyle = '#ffffff';
  ctxRef.beginPath();
  ctxRef.ellipse(x + s * 0.34, y + s * 0.28, s * 0.25, s * 0.18, -0.4, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.restore();
}

function drawGemBorder(ctxRef, x, y, s, stroke) {
  const r = s * 0.2;
  ctxRef.strokeStyle = stroke;
  ctxRef.lineWidth = 2;
  roundRect(ctxRef, x + 1, y + 1, s - 2, s - 2, r);
  ctxRef.stroke();
}

function drawPowerEdges(ctxRef, x, y, s, edges, stroke) {
  ctxRef.strokeStyle = stroke;
  ctxRef.lineWidth = 2.2;
  ctxRef.lineCap = 'round';
  const inset = 2;
  if (edges.top) {
    ctxRef.beginPath();
    ctxRef.moveTo(x + inset, y + inset);
    ctxRef.lineTo(x + s - inset, y + inset);
    ctxRef.stroke();
  }
  if (edges.bottom) {
    ctxRef.beginPath();
    ctxRef.moveTo(x + inset, y + s - inset);
    ctxRef.lineTo(x + s - inset, y + s - inset);
    ctxRef.stroke();
  }
  if (edges.left) {
    ctxRef.beginPath();
    ctxRef.moveTo(x + inset, y + inset);
    ctxRef.lineTo(x + inset, y + s - inset);
    ctxRef.stroke();
  }
  if (edges.right) {
    ctxRef.beginPath();
    ctxRef.moveTo(x + s - inset, y + inset);
    ctxRef.lineTo(x + s - inset, y + s - inset);
    ctxRef.stroke();
  }
}

function drawCrashOverlay(ctxRef, x, y, s) {
  ctxRef.save();
  ctxRef.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctxRef.lineWidth = Math.max(2, s * 0.1);
  ctxRef.lineCap = 'round';
  ctxRef.beginPath();
  ctxRef.moveTo(x + s * 0.24, y + s * 0.24);
  ctxRef.lineTo(x + s * 0.76, y + s * 0.76);
  ctxRef.moveTo(x + s * 0.76, y + s * 0.24);
  ctxRef.lineTo(x + s * 0.24, y + s * 0.76);
  ctxRef.stroke();
  ctxRef.globalAlpha = 0.8;
  ctxRef.beginPath();
  ctxRef.arc(x + s * 0.5, y + s * 0.5, s * 0.16, 0, Math.PI * 2);
  ctxRef.stroke();
  ctxRef.restore();
}

function drawDiamond(ctxRef, x, y, s) {
  const size = s * 0.6;
  ctxRef.save();
  ctxRef.translate(x + s / 2, y + s / 2);
  ctxRef.rotate(Math.PI / 4);
  const grad = ctxRef.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#f9fafb');
  grad.addColorStop(1, '#94a3b8');
  ctxRef.fillStyle = grad;
  ctxRef.fillRect(-size / 2, -size / 2, size, size);
  const rainbow = ctxRef.createLinearGradient(-size / 2, 0, size / 2, 0);
  rainbow.addColorStop(0, '#f43f5e');
  rainbow.addColorStop(0.25, '#f59e0b');
  rainbow.addColorStop(0.5, '#22c55e');
  rainbow.addColorStop(0.75, '#3b82f6');
  rainbow.addColorStop(1, '#a855f7');
  ctxRef.strokeStyle = rainbow;
  ctxRef.lineWidth = s * 0.12;
  ctxRef.strokeRect(-size / 2, -size / 2, size, size);
  ctxRef.restore();
}

function drawCell(ctxRef, cell, col, row) {
  const x = cellToX(col);
  const y = cellToY(row);
  const s = view.cellSize;
  if (cell.kind === Kind.DIAMOND) {
    drawDiamond(ctxRef, x, y, s);
    return;
  }
  if (!cell.color) return;
  const palette = PALETTE[cell.color];
  if (cell.powerGroupId > 0) {
    const powerPalette = {
      base: palette.light,
      light: '#ffffff',
      dark: palette.base,
      stroke: palette.stroke,
    };
    drawGemFill(ctxRef, x, y, s, powerPalette);
    const edges = {
      top: !(row < H - 1 && game.board.cells[row + 1][col].powerGroupId === cell.powerGroupId),
      bottom: !(row > 0 && game.board.cells[row - 1][col].powerGroupId === cell.powerGroupId),
      left: !(col > 0 && game.board.cells[row][col - 1].powerGroupId === cell.powerGroupId),
      right: !(col < W - 1 && game.board.cells[row][col + 1].powerGroupId === cell.powerGroupId),
    };
    drawPowerEdges(ctxRef, x, y, s, edges, palette.stroke);
  } else {
    drawGemFill(ctxRef, x, y, s, palette);
    drawGemBorder(ctxRef, x, y, s, palette.stroke);
  }
  if (cell.kind === Kind.CRASH) {
    drawCrashOverlay(ctxRef, x, y, s);
  }
}

function drawBoard(alpha) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(view.boardLeft, view.boardTop, view.boardLeft, view.boardTop + view.boardHeight);
  bg.addColorStop(0, '#0b2b1f');
  bg.addColorStop(1, '#071b13');
  ctx.fillStyle = bg;
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let c = 1; c < W; c++) {
    const x = view.boardLeft + c * view.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, view.boardTop);
    ctx.lineTo(x, view.boardTop + view.boardHeight);
    ctx.stroke();
  }
  for (let r = 1; r < H; r++) {
    const y = view.boardTop + r * view.cellSize;
    ctx.beginPath();
    ctx.moveTo(view.boardLeft, y);
    ctx.lineTo(view.boardLeft + view.boardWidth, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000000';
  ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.cellSize);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    view.boardLeft + SPAWN_COL * view.cellSize,
    view.boardTop,
    view.cellSize,
    view.cellSize
  );
  ctx.restore();

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind === Kind.EMPTY) continue;
      const overflow = r >= VISIBLE_H;
      if (overflow) ctx.globalAlpha = 0.6;
      drawCell(ctx, cell, c, r);
      if (overflow) ctx.globalAlpha = 1;
    }
  }

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
        drawGemFill(ctx, x, y, s, palette);
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
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!game.nextSpec) return;
  const size = 34;
  const centerX = nextCanvas.width / 2;
  const centerY = nextCanvas.height / 2 + 8;

  const gems = [
    { gem: game.nextSpec.a, row: 0 },
    { gem: game.nextSpec.b, row: 1 },
  ];

  gems.forEach((item, idx) => {
    const x = centerX - size / 2;
    const y = centerY - size / 2 - idx * size;
    if (item.gem.kind === Kind.DIAMOND) {
      drawDiamond(nextCtx, x, y, size);
    } else {
      const palette = PALETTE[item.gem.color];
      drawGemFill(nextCtx, x, y, size, palette);
      drawGemBorder(nextCtx, x, y, size, palette.stroke);
      if (item.gem.kind === Kind.CRASH) {
        drawCrashOverlay(nextCtx, x, y, size);
      }
    }
  });
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
newGame();
loop();
