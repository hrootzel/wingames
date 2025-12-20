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
  GAME_OVER: 'GAME_OVER',
};

const COLORS = ['R', 'G', 'B', 'Y'];
const PALETTE = {
  R: { base: '#ef4444', light: '#fecaca', dark: '#b91c1c' },
  G: { base: '#22c55e', light: '#bbf7d0', dark: '#15803d' },
  B: { base: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' },
  Y: { base: '#facc15', light: '#fef3c7', dark: '#d97706' },
};

const CHAIN_POWER = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288,
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672,
];

const ALL_CLEAR_BONUS = 5000;
const DAS = 160;
const ARR = 60;
const FIXED_DT = 1000 / 60;

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

const view = {
  cellSize: 38,
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
    return;
  }
  game.state = GameState.FALLING;
  game.timers.gravityElapsed = 0;
  game.lastChain = 0;
}

function lockPair() {
  if (!game.active) return;
  const cells = activeCells(game.active);
  for (const cell of cells) {
    game.board.set(cell.row, cell.col, { kind: Kind.COLOR, color: cell.puyo.color });
  }
  game.active = null;
  game.state = GameState.RESOLVE;
}

function handleHorizontalRepeat(dt) {
  const held = game.input.held;
  if (held.left && !held.right) {
    game.repeat.left += dt;
    while (game.repeat.left >= 0) {
      tryMove(0, -1);
      game.repeat.left -= ARR;
    }
  } else {
    game.repeat.left = -DAS;
  }

  if (held.right && !held.left) {
    game.repeat.right += dt;
    while (game.repeat.right >= 0) {
      tryMove(0, 1);
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
    tryRotate(1);
  } else if (game.input.pressed.rotCCW) {
    tryRotate(-1);
  }

  if (game.input.pressed.hardDrop) {
    let guard = 0;
    while (tryMove(-1, 0) && guard < H) {
      guard += 1;
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

function keyFor(r, c) {
  return r * W + c;
}

function findPopGroups() {
  const visited = Array.from({ length: H }, () => Array(W).fill(false));
  const groups = [];

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (visited[r][c]) continue;
      const cell = game.board.get(r, c);
      if (!cell || cell.kind !== Kind.COLOR) continue;
      const color = cell.color;
      const stack = [{ row: r, col: c }];
      const cells = [];
      visited[r][c] = true;

      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        const neighbors = [
          { row: cur.row + 1, col: cur.col },
          { row: cur.row - 1, col: cur.col },
          { row: cur.row, col: cur.col + 1 },
          { row: cur.row, col: cur.col - 1 },
        ];
        for (const n of neighbors) {
          if (!game.board.inBounds(n.row, n.col)) continue;
          if (visited[n.row][n.col]) continue;
          const next = game.board.get(n.row, n.col);
          if (!next || next.kind !== Kind.COLOR || next.color !== color) continue;
          visited[n.row][n.col] = true;
          stack.push(n);
        }
      }

      if (cells.length >= 4) {
        groups.push({ color, cells });
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

  for (const group of groups) {
    groupSizes.push(group.cells.length);
    colors.add(group.color);
    clearedCount += group.cells.length;
    for (const cell of group.cells) {
      popSet.add(keyFor(cell.row, cell.col));
    }
  }

  for (const id of popSet) {
    const row = Math.floor(id / W);
    const col = id % W;
    game.board.set(row, col, makeEmptyCell());
  }

  return {
    clearedCount,
    distinctColors: colors.size,
    groupSizes,
  };
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
  let clearedAny = false;

  while (true) {
    applyGravity();
    const groups = findPopGroups();
    if (groups.length === 0) break;
    const info = clearGroups(groups);
    const linkScore = scoreLink(chainIndex, info.clearedCount, info.distinctColors, info.groupSizes);
    game.score += linkScore;
    game.status = `Link ${chainIndex} +${linkScore}`;
    clearedAny = true;
    chainIndex += 1;
  }

  game.lastChain = clearedAny ? chainIndex - 1 : 0;
  if (game.lastChain < 2) game.lastChain = 0;

  if (clearedAny && isBoardEmpty()) {
    game.score += ALL_CLEAR_BONUS;
    game.status = `All clear +${ALL_CLEAR_BONUS}`;
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
    spawnPair();
  } else if (game.state === GameState.FALLING) {
    stepFalling(dt);
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard();
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

function drawPuyo(ctxRef, x, y, s, colorKey) {
  const palette = PALETTE[colorKey];
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.42;
  const grad = ctxRef.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.55, palette.base);
  grad.addColorStop(1, palette.dark);
  ctxRef.fillStyle = grad;
  ctxRef.beginPath();
  ctxRef.arc(cx, cy, r, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.lineWidth = Math.max(1, s * 0.06);
  ctxRef.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctxRef.stroke();
}

function drawConnector(ctxRef, ax, ay, bx, by, colorKey, s) {
  const palette = PALETTE[colorKey];
  ctxRef.strokeStyle = palette.base;
  ctxRef.lineWidth = s * 0.82;
  ctxRef.lineCap = 'round';
  ctxRef.beginPath();
  ctxRef.moveTo(ax, ay);
  ctxRef.lineTo(bx, by);
  ctxRef.stroke();
}

function drawBoard(alpha) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(view.boardLeft, view.boardTop, view.boardLeft, view.boardTop + view.boardHeight);
  bg.addColorStop(0, '#0f1b21');
  bg.addColorStop(1, '#0a1419');
  ctx.fillStyle = bg;
  ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);

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
  ctx.fillStyle = '#0b0f12';
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
        drawConnector(ctx, ax, ay, bx, by, cell.color, view.cellSize);
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
        drawConnector(ctx, ax, ay, bx, by, cell.color, view.cellSize);
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
    const offset = getFallOffset(alpha);
    const cells = activeCells(game.active);
    const axis = cells[0];
    const child = cells[1];
    const axisPos = { x: cellToX(axis.col) + view.cellSize / 2, y: cellToY(axis.row) + view.cellSize / 2 + offset };
    const childPos = { x: cellToX(child.col) + view.cellSize / 2, y: cellToY(child.row) + view.cellSize / 2 + offset };
    if (axis.puyo.color === child.puyo.color) {
      drawConnector(ctx, axisPos.x, axisPos.y, childPos.x, childPos.y, axis.puyo.color, view.cellSize);
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
}

function drawNextPair() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!game.nextSpec) return;
  const size = 32;
  const x = nextCanvas.width / 2 - size / 2;
  const y = nextCanvas.height / 2 + 6;
  drawPuyo(nextCtx, x, y - size, size, game.nextSpec.childColor);
  drawPuyo(nextCtx, x, y, size, game.nextSpec.axisColor);
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
  chainEl.textContent = game.lastChain >= 2 ? `${game.lastChain}x` : '-';
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

function handleKeyDown(ev) {
  if (ev.repeat) return;
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const key = ev.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    if (!game.input.held.left) {
      game.input.held.left = true;
      tryMove(0, -1);
      game.repeat.left = -DAS;
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      tryMove(0, 1);
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
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.timers.gravityElapsed = 0;
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

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
pauseBtn.addEventListener('click', () => togglePause());

setupView();
newGame();
loop();
