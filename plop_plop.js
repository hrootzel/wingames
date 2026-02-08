import { SfxEngine } from './sfx_engine.js';
import { BANK_PLOPPLOP } from './sfx_bank_plop_plop.js';
import { createPlopPlopSprite } from './plop_plop_sprite.js';
import { initGameShell } from './game-shell.js';

const W = 6;
const H = 14;
const VISIBLE_H = 12;
const SPAWN_COL = 2;
const SPAWN_AXIS_ROW = 12;

const Kind = {
  EMPTY: 'EMPTY',
  COLOR: 'COLOR',
};

const GameState = {
  SPAWN: 'SPAWN',
  FALLING: 'FALLING',
  RESOLVE: 'RESOLVE',
  GARBAGE_DROP: 'GARBAGE_DROP',
  GAME_OVER: 'GAME_OVER',
};

const COLORS = ['R', 'G', 'B', 'Y'];
// Nuisance/garbage blob color (gray)
const GARBAGE_COLOR = 'X';
const PALETTE = {
  R: { base: '#ef4444', light: '#fecaca', dark: '#b91c1c' },
  G: { base: '#22c55e', light: '#bbf7d0', dark: '#15803d' },
  B: { base: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' },
  Y: { base: '#facc15', light: '#fef3c7', dark: '#d97706' },
  X: { base: '#6b7280', light: '#d1d5db', dark: '#374151' }, // Garbage blob
};

// Chain 1 has power 0, chain 2 = 8, then doubles/increases per arcade formula
const CHAIN_POWER = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288,
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672,
];

// Margin time constants (arcade: ~96 frames countdown before garbage drops)
const MARGIN_TIME_FRAMES = 96;

// Arcade nuisance rate: 70 points per garbage
const NUISANCE_RATE = 70;
const ALL_CLEAR_BONUS = 2100; // Arcade: 30 garbage worth = 30 * 70
const DAS = 160;
const ARR = 60;
const FIXED_DT = 1000 / 60;
const RESOLVE_DROP_INTERVAL = 60;

const canvas = document.getElementById('plop-canvas');
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
  cellSize: 38,
  boardLeft: 0,
  boardTop: 0,
  boardWidth: 0,
  boardHeight: 0,
};

const BRIDGE_PINCH = 0.62;
const BRIDGE_STEPS = 8;

const game = makeGame();
const { drawPuyo, drawBridge } = createPlopPlopSprite(PALETTE, BRIDGE_PINCH, BRIDGE_STEPS);

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
  return { kind: Kind.EMPTY, color: null };
}

function makeBoard() {
  const cells = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => makeEmptyCell())
  );
  return {
    cells,
    inBounds(r, c) {
      return r >= 0 && r < H && c >= 0 && c < W;
    },
    get(r, c) {
      return this.inBounds(r, c) ? this.cells[r][c] : null;
    },
    set(r, c, v) {
      this.cells[r][c] = v;
    },
    isEmpty(r, c) {
      const cell = this.get(r, c);
      return cell && cell.kind === Kind.EMPTY;
    },
  };
}

function makeInput() {
  return {
    held: { left: false, right: false, down: false },
    pressed: { rotCW: false, rotCCW: false, hardDrop: false },
    clearPressed() {
      this.pressed.rotCW = false;
      this.pressed.rotCCW = false;
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
    resolve: null,
    pieceIndex: 0,
    level: 1,
    score: 0,
    lastChain: 0,
    maxChain: 0, // Track best chain for display
    pendingGarbage: 0, // Nuisance blobs waiting to drop
    garbageCounter: 0, // Accumulated points toward garbage
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    timers: { gravityElapsed: 0 },
    fx: {
      phase: 0,
      shake: 0,
      hitstop: 0,
      pulse: 0,
      particles: [],
      banners: [],
    },
  };
}

function addBanner(text) {
  game.fx.banners.push({ text, life: 900, ttl: 900 });
}

function triggerClearFx(clearedCount, chainIndex, distinctColors) {
  const fx = game.fx;
  fx.hitstop = Math.max(fx.hitstop, chainIndex >= 2 ? 70 : 42);
  fx.shake = Math.min(12, fx.shake + 1.3 + chainIndex * 1.15 + clearedCount * 0.05);
  fx.pulse = Math.min(1.2, fx.pulse + 0.3 + chainIndex * 0.08 + distinctColors * 0.06);
  const particleCount = Math.min(44, 9 + clearedCount * 2 + chainIndex * 4);
  for (let i = 0; i < particleCount; i++) {
    const ang = game.rng.next() * Math.PI * 2;
    const speed = 24 + game.rng.next() * 86 + chainIndex * 8;
    const hue = (190 + game.rng.next() * 90 + chainIndex * 8) % 360;
    fx.particles.push({
      x: view.boardLeft + view.boardWidth * (0.16 + game.rng.next() * 0.68),
      y: view.boardTop + view.boardHeight * (0.18 + game.rng.next() * 0.64),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 36,
      life: 260 + game.rng.next() * 420,
      ttl: 260 + game.rng.next() * 420,
      size: 2 + game.rng.next() * 5,
      hue,
    });
  }
  if (chainIndex >= 2) addBanner(`${chainIndex}-CHAIN`);
}

function updateFx(dt) {
  const fx = game.fx;
  fx.phase = (fx.phase + dt * 0.0032) % (Math.PI * 2);
  fx.shake = Math.max(0, fx.shake - dt * 0.017);
  fx.pulse = Math.max(0, fx.pulse - dt * 0.0024);
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.vy += 210 * (dt / 1000);
    p.vx *= 0.992;
  }
  for (let i = fx.banners.length - 1; i >= 0; i--) {
    const b = fx.banners[i];
    b.life -= dt;
    if (b.life <= 0) fx.banners.splice(i, 1);
  }
}

function resetBoard() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c] = makeEmptyCell();
    }
  }
}

function rollColor(rng) {
  return COLORS[rng.int(COLORS.length)];
}

function rollPairSpec(rng) {
  return { axisColor: rollColor(rng), childColor: rollColor(rng) };
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

function makeActivePair(spec) {
  return {
    axisRow: SPAWN_AXIS_ROW,
    axisCol: SPAWN_COL,
    orient: 0,
    axis: { kind: Kind.COLOR, color: spec.axisColor },
    child: { kind: Kind.COLOR, color: spec.childColor },
  };
}

function activeCells(pair, orientOverride, rowOverride, colOverride) {
  const orient = orientOverride === undefined ? pair.orient : orientOverride;
  const axisRow = rowOverride === undefined ? pair.axisRow : rowOverride;
  const axisCol = colOverride === undefined ? pair.axisCol : colOverride;
  const off = orientOffset(orient);
  return [
    { row: axisRow, col: axisCol, puyo: pair.axis, which: 'axis' },
    { row: axisRow + off.dr, col: axisCol + off.dc, puyo: pair.child, which: 'child' },
  ];
}

function canPlace(pair, row, col, orient) {
  const cells = activeCells(pair, orient, row, col);
  for (const cell of cells) {
    if (!game.board.inBounds(cell.row, cell.col)) return false;
    if (!game.board.isEmpty(cell.row, cell.col)) return false;
  }
  return true;
}

function tryMove(dr, dc) {
  if (!game.active) return false;
  const nextRow = game.active.axisRow + dr;
  const nextCol = game.active.axisCol + dc;
  if (!canPlace(game.active, nextRow, nextCol, game.active.orient)) return false;
  game.active.axisRow = nextRow;
  game.active.axisCol = nextCol;
  return true;
}

function tryRotate(dir) {
  if (!game.active) return false;
  const nextOrient = (game.active.orient + dir + 4) & 3;
  if (!canPlace(game.active, game.active.axisRow, game.active.axisCol, nextOrient)) return false;
  game.active.orient = nextOrient;
  return true;
}

function gravityInterval() {
  const base = Math.max(140, 760 - (game.level - 1) * 55);
  if (game.input.held.down) {
    return Math.max(30, Math.floor(base / 10));
  }
  return base;
}

function spawnPair() {
  game.pieceIndex += 1;
  game.level = 1 + Math.floor((game.pieceIndex - 1) / 20);
  const spec = game.nextSpec || rollPairSpec(game.rng);
  game.active = makeActivePair(spec);
  game.nextSpec = rollPairSpec(game.rng);
  if (!canPlace(game.active, game.active.axisRow, game.active.axisCol, game.active.orient)) {
    game.state = GameState.GAME_OVER;
    game.status = 'Game over. Press R to restart.';
    sfx.play(BANK_PLOPPLOP, 'gameOver');
    return;
  }
  game.state = GameState.FALLING;
  game.timers.gravityElapsed = 0;
  game.lastChain = 0;
}

function lockPair() {
  if (!game.active) return;
  sfx.play(BANK_PLOPPLOP, 'lock');
  const cells = activeCells(game.active);
  for (const cell of cells) {
    game.board.set(cell.row, cell.col, { kind: Kind.COLOR, color: cell.puyo.color });
  }
  game.active = null;
  game.state = GameState.RESOLVE;
  game.resolve = { chainIndex: 1, clearedAny: false, settling: true, settleTimer: 0 };
}

function handleHorizontalRepeat(dt) {
  const held = game.input.held;
  if (held.left && !held.right) {
    game.repeat.left += dt;
    while (game.repeat.left >= 0) {
      if (tryMove(0, -1)) {
        sfx.play(BANK_PLOPPLOP, 'move');
      }
      game.repeat.left -= ARR;
    }
  } else {
    game.repeat.left = -DAS;
  }

  if (held.right && !held.left) {
    game.repeat.right += dt;
    while (game.repeat.right >= 0) {
      if (tryMove(0, 1)) {
        sfx.play(BANK_PLOPPLOP, 'move');
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

  if (game.input.pressed.rotCW) {
    if (tryRotate(1)) {
      sfx.play(BANK_PLOPPLOP, 'rotate');
    }
  } else if (game.input.pressed.rotCCW) {
    if (tryRotate(-1)) {
      sfx.play(BANK_PLOPPLOP, 'rotate');
    }
  }

  if (game.input.pressed.hardDrop) {
    let guard = 0;
    while (tryMove(-1, 0) && guard < H) {
      guard += 1;
    }
    if (guard > 0) {
      sfx.play(BANK_PLOPPLOP, 'hardDrop');
    }
    lockPair();
    return;
  }

  handleHorizontalRepeat(dt);

  const interval = gravityInterval();
  game.timers.gravityElapsed += dt;
  while (game.timers.gravityElapsed >= interval) {
    if (!tryMove(-1, 0)) {
      lockPair();
      return;
    }
    game.timers.gravityElapsed -= interval;
  }
}

function applyGravity() {
  for (let c = 0; c < W; c++) {
    const stack = [];
    for (let r = 0; r < H; r++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.EMPTY) stack.push(cell);
    }
    for (let r = 0; r < H; r++) {
      game.board.cells[r][c] = stack[r] ? stack[r] : makeEmptyCell();
    }
  }
}

function settleOnce() {
  let moved = false;
  for (let r = 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.get(r, c);
      if (!cell || cell.kind === Kind.EMPTY) continue;
      if (!game.board.isEmpty(r - 1, c)) continue;
      game.board.set(r - 1, c, cell);
      game.board.set(r, c, makeEmptyCell());
      moved = true;
    }
  }
  return moved;
}

function keyFor(r, c) {
  return r * W + c;
}

// Pre-allocated buffers for flood-fill (arcade-style optimization)
const _visited = new Uint8Array(H * W);
const _stack = new Uint16Array(H * W);
const _groupCells = new Uint16Array(H * W);
// Neighbor offsets: down, up, right, left (matches arcade loc_00004F90)
const _neighborOffsets = [W, -W, 1, -1];
const _neighborColDelta = [0, 0, 1, -1];

function findPopGroups() {
  _visited.fill(0);
  const groups = [];
  const cells = game.board.cells;

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const idx = r * W + c;
      if (_visited[idx]) continue;
      const cell = cells[r][c];
      if (cell.kind !== Kind.COLOR) continue;
      const color = cell.color;

      // Flood-fill using pre-allocated stack
      let stackLen = 1, groupLen = 0;
      _stack[0] = idx;
      _visited[idx] = 1;

      while (stackLen > 0) {
        const cur = _stack[--stackLen];
        _groupCells[groupLen++] = cur;
        const curCol = cur % W;

        for (let i = 0; i < 4; i++) {
          const ni = cur + _neighborOffsets[i];
          const nc = curCol + _neighborColDelta[i];
          // Bounds check: column wrap and array bounds
          if (nc < 0 || nc >= W || ni < 0 || ni >= H * W) continue;
          if (_visited[ni]) continue;
          const nr = (ni / W) | 0;
          const next = cells[nr][nc];
          if (next.kind !== Kind.COLOR || next.color !== color) continue;
          _visited[ni] = 1;
          _stack[stackLen++] = ni;
        }
      }

      if (groupLen >= 4) {
        const groupCells = [];
        for (let i = 0; i < groupLen; i++) {
          const gi = _groupCells[i];
          groupCells.push({ row: (gi / W) | 0, col: gi % W });
        }
        groups.push({ color, cells: groupCells });
      }
    }
  }

  return groups;
}

function chainPower(chainIndex) {
  if (chainIndex <= 24) return CHAIN_POWER[chainIndex - 1];
  return Math.min(999, 672 + 32 * (chainIndex - 24));
}

function colorBonus(distinctColors) {
  switch (distinctColors) {
    case 1:
      return 0;
    case 2:
      return 3;
    case 3:
      return 6;
    case 4:
      return 12;
    case 5:
      return 24;
    default:
      return 0;
  }
}

function groupBonusForSize(n) {
  if (n <= 4) return 0;
  if (n === 5) return 2;
  if (n === 6) return 3;
  if (n === 7) return 4;
  if (n === 8) return 5;
  if (n === 9) return 6;
  if (n === 10) return 7;
  return 10;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function scoreLink(chainIndex, clearedCount, distinctColors, groupSizes) {
  const CP = chainPower(chainIndex);
  const CB = colorBonus(distinctColors);
  const GB = groupSizes.reduce((sum, n) => sum + groupBonusForSize(n), 0);
  const bonus = clamp(CP + CB + GB, 1, 999);
  return (10 * clearedCount) * bonus;
}

function clearGroups(groups) {
  const popSet = new Set();
  const colors = new Set();
  const groupSizes = [];
  let clearedCount = 0;

  // First pass: mark all colored blobs to clear
  for (const group of groups) {
    groupSizes.push(group.cells.length);
    colors.add(group.color);
    clearedCount += group.cells.length;
    for (const cell of group.cells) {
      popSet.add(keyFor(cell.row, cell.col));
    }
  }

  // Second pass: find adjacent garbage blobs to clear
  const garbageToRemove = new Set();
  for (const id of popSet) {
    const row = (id / W) | 0;
    const col = id % W;
    // Check 4 neighbors without object allocation
    if (row + 1 < H) {
      const cell = game.board.cells[row + 1][col];
      if (cell.kind === Kind.COLOR && cell.color === GARBAGE_COLOR)
        garbageToRemove.add(keyFor(row + 1, col));
    }
    if (row > 0) {
      const cell = game.board.cells[row - 1][col];
      if (cell.kind === Kind.COLOR && cell.color === GARBAGE_COLOR)
        garbageToRemove.add(keyFor(row - 1, col));
    }
    if (col + 1 < W) {
      const cell = game.board.cells[row][col + 1];
      if (cell.kind === Kind.COLOR && cell.color === GARBAGE_COLOR)
        garbageToRemove.add(keyFor(row, col + 1));
    }
    if (col > 0) {
      const cell = game.board.cells[row][col - 1];
      if (cell.kind === Kind.COLOR && cell.color === GARBAGE_COLOR)
        garbageToRemove.add(keyFor(row, col - 1));
    }
  }

  // Clear colored blobs
  for (const id of popSet) {
    game.board.set((id / W) | 0, id % W, makeEmptyCell());
  }

  // Clear garbage blobs
  for (const id of garbageToRemove) {
    game.board.set((id / W) | 0, id % W, makeEmptyCell());
  }

  return { clearedCount, distinctColors: colors.size, groupSizes };
}

function isBoardEmpty() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (game.board.cells[r][c].kind !== Kind.EMPTY) return false;
    }
  }
  return true;
}

function resolveBoard(dt) {
  const resolve = game.resolve || {
    chainIndex: 1,
    clearedAny: false,
    settling: false,
    settleTimer: 0,
    totalScore: 0, // Track score for this chain sequence
  };

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

  const groups = findPopGroups();
  if (groups.length === 0) {
    game.lastChain = resolve.clearedAny ? resolve.chainIndex - 1 : 0;
    if (game.lastChain < 2) game.lastChain = 0;
    if (game.lastChain > game.maxChain) game.maxChain = game.lastChain;

    // Calculate garbage generated from this chain sequence
    if (resolve.totalScore > 0) {
      const garbageGenerated = Math.floor(resolve.totalScore / NUISANCE_RATE);
      game.garbageCounter += garbageGenerated;
    }

    if (resolve.clearedAny && isBoardEmpty()) {
      game.score += ALL_CLEAR_BONUS;
      game.garbageCounter += Math.floor(ALL_CLEAR_BONUS / NUISANCE_RATE);
      game.status = `All clear! +${ALL_CLEAR_BONUS}`;
      sfx.play(BANK_PLOPPLOP, 'allClear');
    }

    game.state = GameState.SPAWN;
    game.resolve = null;
    return;
  }

  const info = clearGroups(groups);
  const chainIndex = resolve.chainIndex;
  const linkScore = scoreLink(chainIndex, info.clearedCount, info.distinctColors, info.groupSizes);
  game.score += linkScore;
  resolve.totalScore += linkScore;
  
  // Status shows chain count and score
  if (chainIndex >= 2) {
    game.status = `${chainIndex}-Chain! +${linkScore}`;
    sfx.play(BANK_PLOPPLOP, 'chain', { chain: chainIndex });
  } else {
    game.status = `Pop! +${linkScore}`;
  }
  triggerClearFx(info.clearedCount, chainIndex, info.distinctColors);
  sfx.play(BANK_PLOPPLOP, 'clear', { cleared: info.clearedCount, chain: chainIndex });
  resolve.clearedAny = true;
  resolve.chainIndex += 1;
  resolve.settling = true;
  resolve.settleTimer = 0;
  game.resolve = resolve;
}

function stepGame(dt) {
  updateFx(dt);
  if (game.state === GameState.GAME_OVER) {
    game.input.clearPressed();
    return;
  }
  if (game.paused) {
    game.input.clearPressed();
    return;
  }

  if (game.fx.hitstop > 0) {
    game.fx.hitstop = Math.max(0, game.fx.hitstop - dt);
    game.input.clearPressed();
    return;
  }

  if (game.state === GameState.SPAWN) {
    spawnPair();
  } else if (game.state === GameState.FALLING) {
    stepFalling(dt);
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard(dt);
  }

  game.input.clearPressed();
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
  const rr = Math.min(r, w / 2, h / 2);
  ctxRef.beginPath();
  ctxRef.moveTo(x + rr, y);
  ctxRef.arcTo(x + w, y, x + w, y + h, rr);
  ctxRef.arcTo(x + w, y + h, x, y + h, rr);
  ctxRef.arcTo(x, y + h, x, y, rr);
  ctxRef.arcTo(x, y, x + w, y, rr);
  ctxRef.closePath();
}

function getGhostDropRows(pair) {
  if (!pair) return null;
  const cells = activeCells(pair);
  let drop = H;
  for (const cell of cells) {
    let d = 0;
    let nr = cell.row - 1;
    while (nr >= 0 && game.board.isEmpty(nr, cell.col)) {
      d += 1;
      nr -= 1;
    }
    if (d < drop) drop = d;
  }
  if (!Number.isFinite(drop) || drop <= 0) return null;
  return cells.map((cell) => ({ ...cell, row: cell.row - drop }));
}

function drawEffects() {
  const pulse = game.fx.pulse;
  if (pulse > 0) {
    const spread = 18 + pulse * 18;
    const glow = ctx.createRadialGradient(
      view.boardLeft + view.boardWidth / 2,
      view.boardTop + view.boardHeight / 2,
      22,
      view.boardLeft + view.boardWidth / 2,
      view.boardTop + view.boardHeight / 2,
      view.boardWidth * 0.68 + spread
    );
    glow.addColorStop(0, `rgba(254, 240, 138, ${0.2 * pulse})`);
    glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);
  }

  for (const p of game.fx.particles) {
    const t = Math.max(0, p.life / p.ttl);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = `hsl(${p.hue} 90% 66%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.45 + t * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const b of game.fx.banners) {
    const t = 1 - b.life / b.ttl;
    const alpha = t < 0.2 ? t / 0.2 : (1 - t) / 0.8;
    const y = view.boardTop + view.boardHeight * (0.45 - t * 0.14);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(3, 8, 20, 0.78)';
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 31px Trebuchet MS, Segoe UI, sans-serif';
    ctx.strokeText(b.text, view.boardLeft + view.boardWidth / 2, y);
    ctx.fillText(b.text, view.boardLeft + view.boardWidth / 2, y);
    ctx.restore();
  }
}

function drawBoard(alpha) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const shakeX = (game.rng.next() * 2 - 1) * game.fx.shake;
  const shakeY = (game.rng.next() * 2 - 1) * game.fx.shake * 0.72;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  const bg = ctx.createLinearGradient(view.boardLeft, view.boardTop, view.boardLeft, view.boardTop + view.boardHeight);
  bg.addColorStop(0, '#153141');
  bg.addColorStop(0.56, '#102635');
  bg.addColorStop(1, '#0a1623');
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  ctx.fillStyle = bg;
  ctx.fill();

  const sheen = ctx.createLinearGradient(view.boardLeft, view.boardTop, view.boardLeft, view.boardTop + view.boardHeight);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.04)');
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  ctx.fillStyle = sheen;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.lineWidth = 2;
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 16);
  ctx.stroke();

  const spawnPulse = 0.11 + 0.08 * Math.sin(game.fx.phase * 2.2);
  ctx.save();
  ctx.fillStyle = `rgba(134, 239, 172, ${spawnPulse})`;
  ctx.fillRect(
    view.boardLeft + SPAWN_COL * view.cellSize,
    view.boardTop,
    view.cellSize,
    view.cellSize
  );
  ctx.restore();

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
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#070d14';
  const hiddenHeight = (H - VISIBLE_H) * view.cellSize;
  ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, hiddenHeight);
  ctx.restore();

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.COLOR) continue;
      const right = c + 1 < W ? game.board.cells[r][c + 1] : null;
      if (right && right.kind === Kind.COLOR && right.color === cell.color) {
        const ax = cellToX(c) + view.cellSize / 2;
        const ay = cellToY(r) + view.cellSize / 2;
        const bx = cellToX(c + 1) + view.cellSize / 2;
        const by = ay;
        ctx.save();
        if (r >= VISIBLE_H) ctx.globalAlpha = 0.6;
        drawBridge(ctx, ax, ay, bx, by, cell.color, view.cellSize);
        ctx.restore();
      }
      const up = r + 1 < H ? game.board.cells[r + 1][c] : null;
      if (up && up.kind === Kind.COLOR && up.color === cell.color) {
        const ax = cellToX(c) + view.cellSize / 2;
        const ay = cellToY(r) + view.cellSize / 2;
        const bx = ax;
        const by = cellToY(r + 1) + view.cellSize / 2;
        ctx.save();
        if (r >= VISIBLE_H || r + 1 >= VISIBLE_H) ctx.globalAlpha = 0.6;
        drawBridge(ctx, ax, ay, bx, by, cell.color, view.cellSize);
        ctx.restore();
      }
    }
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.cells[r][c];
      if (cell.kind !== Kind.COLOR) continue;
      const x = cellToX(c);
      const y = cellToY(r);
      ctx.save();
      if (r >= VISIBLE_H) ctx.globalAlpha = 0.6;
      drawPuyo(ctx, x, y, view.cellSize, cell.color);
      ctx.restore();
    }
  }

  if (game.active) {
    const ghostCells = getGhostDropRows(game.active);
    if (ghostCells) {
      const a = ghostCells[0];
      const b = ghostCells[1];
      ctx.save();
      ctx.globalAlpha = 0.22;
      if (a.puyo.color === b.puyo.color) {
        drawBridge(
          ctx,
          cellToX(a.col) + view.cellSize / 2,
          cellToY(a.row) + view.cellSize / 2,
          cellToX(b.col) + view.cellSize / 2,
          cellToY(b.row) + view.cellSize / 2,
          a.puyo.color,
          view.cellSize
        );
      }
      drawPuyo(ctx, cellToX(a.col), cellToY(a.row), view.cellSize, a.puyo.color);
      drawPuyo(ctx, cellToX(b.col), cellToY(b.row), view.cellSize, b.puyo.color);
      ctx.restore();
    }
  }

  if (game.active) {
    const offset = getFallOffset(alpha);
    const cells = activeCells(game.active);
    const axis = cells[0];
    const child = cells[1];
    const axisPos = { x: cellToX(axis.col) + view.cellSize / 2, y: cellToY(axis.row) + view.cellSize / 2 + offset };
    const childPos = { x: cellToX(child.col) + view.cellSize / 2, y: cellToY(child.row) + view.cellSize / 2 + offset };
    if (axis.puyo.color === child.puyo.color) {
      drawBridge(ctx, axisPos.x, axisPos.y, childPos.x, childPos.y, axis.puyo.color, view.cellSize);
    }
    drawPuyo(ctx, cellToX(axis.col), cellToY(axis.row) + offset, view.cellSize, axis.puyo.color);
    drawPuyo(ctx, cellToX(child.col), cellToY(child.row) + offset, view.cellSize, child.puyo.color);
  }

  if (game.paused || game.state === GameState.GAME_OVER) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px Trebuchet MS, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = game.state === GameState.GAME_OVER ? 'Game Over' : 'Paused';
    ctx.fillText(label, view.boardLeft + view.boardWidth / 2, view.boardTop + view.boardHeight / 2);
    ctx.restore();
  }
  drawEffects();
  ctx.restore();
}

function drawNextPair() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!game.nextSpec) return;
  const size = 32;
  const glow = nextCtx.createRadialGradient(
    nextCanvas.width / 2,
    nextCanvas.height / 2,
    6,
    nextCanvas.width / 2,
    nextCanvas.height / 2,
    56
  );
  glow.addColorStop(0, 'rgba(186, 230, 253, 0.2)');
  glow.addColorStop(1, 'rgba(186, 230, 253, 0)');
  nextCtx.fillStyle = glow;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  nextCtx.save();
  const bob = Math.sin(game.fx.phase * 2.4) * 2.4;
  const x = nextCanvas.width / 2 - size / 2;
  const y = nextCanvas.height / 2 + 6 + bob;
  if (game.nextSpec.childColor === game.nextSpec.axisColor) {
    drawBridge(
      nextCtx,
      x + size / 2,
      y - size / 2,
      x + size / 2,
      y + size / 2,
      game.nextSpec.axisColor,
      size
    );
  }
  drawPuyo(nextCtx, x, y - size, size, game.nextSpec.childColor);
  drawPuyo(nextCtx, x, y, size, game.nextSpec.axisColor);
  nextCtx.restore();
}

function canMoveDown() {
  if (!game.active) return false;
  const cells = activeCells(game.active);
  for (const cell of cells) {
    const nextRow = cell.row - 1;
    if (!game.board.inBounds(nextRow, cell.col)) return false;
    if (!game.board.isEmpty(nextRow, cell.col)) return false;
  }
  return true;
}

function getFallOffset(alpha) {
  if (!game.active || game.state !== GameState.FALLING) return 0;
  if (!canMoveDown()) return 0;
  const interval = gravityInterval();
  const blend = alpha === undefined ? 0 : alpha;
  const t = Math.min(1, (game.timers.gravityElapsed + blend * FIXED_DT) / interval);
  return t * view.cellSize;
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  // Show current chain or max chain achieved
  if (game.lastChain >= 2) {
    chainEl.textContent = `${game.lastChain}x`;
  } else if (game.maxChain >= 2) {
    chainEl.textContent = `(${game.maxChain}x)`;
  } else {
    chainEl.textContent = '-';
  }
  levelEl.textContent = game.level.toString();
  piecesEl.textContent = game.pieceIndex.toString();
  statusEl.textContent = game.paused ? 'Paused' : game.status;
}

function draw(alpha) {
  drawBoard(alpha);
  drawNextPair();
  updateHud();
}

function togglePause() {
  if (game.state === GameState.GAME_OVER) return;
  const next = !game.paused;
  if (next) {
    game.statusBeforePause = game.status;
    game.status = 'Paused';
  } else {
    game.status = game.statusBeforePause || game.status;
  }
  game.paused = next;
  pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
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
      if (tryMove(0, -1)) {
        sfx.play(BANK_PLOPPLOP, 'move');
      }
      game.repeat.left = -DAS;
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      if (tryMove(0, 1)) {
        sfx.play(BANK_PLOPPLOP, 'move');
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
    game.input.pressed.rotCW = true;
    ev.preventDefault();
    return;
  }
  if (key === 'z' || key === 'q') {
    game.input.pressed.rotCCW = true;
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

function newGame() {
  const seed = (Date.now() >>> 0) ^ (Math.random() * 0xffffffff);
  game.rng = makeRng(seed);
  resetBoard();
  game.input.held.left = false;
  game.input.held.right = false;
  game.input.held.down = false;
  game.input.clearPressed();
  game.repeat.left = -DAS;
  game.repeat.right = -DAS;
  game.state = GameState.SPAWN;
  game.paused = false;
  game.active = null;
  game.nextSpec = rollPairSpec(game.rng);
  game.pieceIndex = 0;
  game.level = 1;
  game.score = 0;
  game.lastChain = 0;
  game.maxChain = 0;
  game.pendingGarbage = 0;
  game.garbageCounter = 0;
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.resolve = null;
  game.timers.gravityElapsed = 0;
  game.fx.phase = 0;
  game.fx.shake = 0;
  game.fx.hitstop = 0;
  game.fx.pulse = 0;
  game.fx.particles.length = 0;
  game.fx.banners.length = 0;
  pauseBtn.textContent = 'Pause';
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
  shellEl: '.plop-wrap',
  surfaceEl: '#plop-surface',
  canvasEl: canvas,
  baseWidth: canvas.width,
  baseHeight: canvas.height,

  mode: 'fractional',
  fit: 'css',
  onResize: setupView,
});
newGame();
loop();
