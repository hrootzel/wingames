const W = 8;
const H = 18;
const VISIBLE_H = 16;

const Kind = {
  EMPTY: 'EMPTY',
  VIRUS: 'VIRUS',
  SEGMENT: 'SEGMENT',
};

const Link = {
  L: 'L',
  R: 'R',
  U: 'U',
  D: 'D',
  NONE: null,
};

const Speed = {
  LOW: 'LOW',
  MED: 'MED',
  HI: 'HI',
};

const GameState = {
  SPAWN: 'SPAWN',
  FALLING: 'FALLING',
  RESOLVE: 'RESOLVE',
  STAGE_CLEAR: 'STAGE_CLEAR',
  GAME_OVER: 'GAME_OVER',
};

const COLORS = ['R', 'B', 'Y'];
const PALETTE = {
  R: { base: '#ef4444', light: '#fecaca', dark: '#b91c1c' },
  B: { base: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' },
  Y: { base: '#facc15', light: '#fef3c7', dark: '#d97706' },
};

const VIRUS_POINTS = {
  LOW: [0, 100, 200, 400, 800, 1600, 3200],
  MED: [0, 200, 400, 800, 1600, 3200, 6400],
  HI: [0, 300, 600, 1200, 2400, 4800, 9600],
};

const GRAVITY_BASE = {
  LOW: 720,
  MED: 460,
  HI: 260,
};

const SOFT_DROP_MULT = 8;
const DAS = 160;
const ARR = 60;
const FIXED_DT = 1000 / 60;

const canvas = document.getElementById('pill-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const virusesEl = document.getElementById('viruses');
const levelEl = document.getElementById('level');
const speedLabelEl = document.getElementById('speed-label');
const statusEl = document.getElementById('status');
const speedSelect = document.getElementById('speed');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const view = {
  cellSize: 32,
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
  return { kind: Kind.EMPTY, color: null, pillId: null, link: Link.NONE };
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
    pressed: { rotate: false, rotateCCW: false, hardDrop: false },
    clearPressed() {
      this.pressed.rotate = false;
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
    pillId: 1,
    score: 0,
    virusLevel: 0,
    virusesRemaining: 0,
    speed: Speed.MED,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    timers: { gravityElapsed: 0, stageClearRemaining: 0 },
  };
}

function resetBoard() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c] = makeEmptyCell();
    }
  }
}

function rollColor3(rng) {
  return COLORS[rng.int(COLORS.length)];
}

function rollCapsuleSpec(rng) {
  return { aColor: rollColor3(rng), bColor: rollColor3(rng) };
}

function makeActiveCapsule(spec) {
  return {
    aRow: 17,
    aCol: 3,
    orient: 0,
    aColor: spec.aColor,
    bColor: spec.bColor,
  };
}

function activeCells(active, orientOverride, colOverride, rowOverride) {
  const orient = orientOverride === undefined ? active.orient : orientOverride;
  const aRow = rowOverride === undefined ? active.aRow : rowOverride;
  const aCol = colOverride === undefined ? active.aCol : colOverride;
  const a = { r: aRow, c: aCol, color: active.aColor, which: 'A' };
  if (orient === 0) {
    return [a, { r: aRow, c: aCol + 1, color: active.bColor, which: 'B' }];
  }
  return [a, { r: aRow + 1, c: aCol, color: active.bColor, which: 'B' }];
}

function canPlaceActive(aRow, aCol, orient) {
  const cells = activeCells(game.active, orient, aCol, aRow);
  for (const cell of cells) {
    if (!game.board.inBounds(cell.r, cell.c)) return false;
    if (!game.board.isEmpty(cell.r, cell.c)) return false;
  }
  return true;
}

function tryMoveActive(dr, dc) {
  if (!game.active) return false;
  const nextRow = game.active.aRow + dr;
  const nextCol = game.active.aCol + dc;
  if (!canPlaceActive(nextRow, nextCol, game.active.orient)) return false;
  game.active.aRow = nextRow;
  game.active.aCol = nextCol;
  return true;
}

function tryRotate() {
  if (!game.active) return false;
  const nextOrient = game.active.orient === 0 ? 1 : 0;
  const kicks = [0, -1, 1];
  for (const kick of kicks) {
    const nextCol = game.active.aCol + kick;
    if (canPlaceActive(game.active.aRow, nextCol, nextOrient)) {
      game.active.aCol = nextCol;
      game.active.orient = nextOrient;
      return true;
    }
  }
  return false;
}

function gravityInterval() {
  const base = GRAVITY_BASE[game.speed] ?? GRAVITY_BASE.MED;
  const scaled = Math.max(90, base - game.virusLevel * 12);
  if (game.input.held.down) {
    return Math.max(20, Math.floor(scaled / SOFT_DROP_MULT));
  }
  return scaled;
}

function spawnCapsule() {
  game.nextSpec = game.nextSpec || rollCapsuleSpec(game.rng);
  game.active = makeActiveCapsule(game.nextSpec);
  game.nextSpec = rollCapsuleSpec(game.rng);
  if (!canPlaceActive(game.active.aRow, game.active.aCol, game.active.orient)) {
    game.state = GameState.GAME_OVER;
    game.status = 'Game over. Press R to restart.';
    return;
  }
  game.state = GameState.FALLING;
  game.timers.gravityElapsed = 0;
}

function lockCapsule() {
  const active = game.active;
  if (!active) return;
  const cells = activeCells(active);
  const id = game.pillId++;
  const aLink = active.orient === 0 ? Link.R : Link.U;
  const bLink = active.orient === 0 ? Link.L : Link.D;

  game.board.set(cells[0].r, cells[0].c, {
    kind: Kind.SEGMENT,
    color: cells[0].color,
    pillId: id,
    link: aLink,
  });
  game.board.set(cells[1].r, cells[1].c, {
    kind: Kind.SEGMENT,
    color: cells[1].color,
    pillId: id,
    link: bLink,
  });

  game.active = null;
  game.state = GameState.RESOLVE;
}

function handleHorizontalRepeat(dt) {
  const held = game.input.held;
  if (held.left && !held.right) {
    game.repeat.left += dt;
    while (game.repeat.left >= 0) {
      tryMoveActive(0, -1);
      game.repeat.left -= ARR;
    }
  } else {
    game.repeat.left = -DAS;
  }

  if (held.right && !held.left) {
    game.repeat.right += dt;
    while (game.repeat.right >= 0) {
      tryMoveActive(0, 1);
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

  if (game.input.pressed.rotate || game.input.pressed.rotateCCW) {
    tryRotate();
  }

  if (game.input.pressed.hardDrop) {
    let guard = 0;
    while (tryMoveActive(-1, 0) && guard < H) {
      guard += 1;
    }
    lockCapsule();
    return;
  }

  handleHorizontalRepeat(dt);

  const interval = gravityInterval();
  game.timers.gravityElapsed += dt;
  while (game.timers.gravityElapsed >= interval) {
    if (!tryMoveActive(-1, 0)) {
      lockCapsule();
      return;
    }
    game.timers.gravityElapsed -= interval;
  }
}

function keyFor(r, c) {
  return r * 100 + c;
}

function findMatches(board) {
  const clear = new Set();

  for (let r = 0; r < VISIBLE_H; r++) {
    let c = 0;
    while (c < W) {
      const cell = board.get(r, c);
      const color = cell && cell.kind !== Kind.EMPTY ? cell.color : null;
      if (!color) {
        c += 1;
        continue;
      }
      let c2 = c + 1;
      while (c2 < W) {
        const next = board.get(r, c2);
        if (!next || next.kind === Kind.EMPTY || next.color !== color) break;
        c2 += 1;
      }
      const len = c2 - c;
      if (len >= 4) {
        for (let k = c; k < c2; k++) clear.add(keyFor(r, k));
      }
      c = c2;
    }
  }

  for (let c = 0; c < W; c++) {
    let r = 0;
    while (r < VISIBLE_H) {
      const cell = board.get(r, c);
      const color = cell && cell.kind !== Kind.EMPTY ? cell.color : null;
      if (!color) {
        r += 1;
        continue;
      }
      let r2 = r + 1;
      while (r2 < VISIBLE_H) {
        const next = board.get(r2, c);
        if (!next || next.kind === Kind.EMPTY || next.color !== color) break;
        r2 += 1;
      }
      const len = r2 - r;
      if (len >= 4) {
        for (let k = r; k < r2; k++) clear.add(keyFor(k, c));
      }
      r = r2;
    }
  }

  return clear;
}

function breakPartnerLink(board, r, c, cell) {
  if (cell.kind !== Kind.SEGMENT || !cell.link) return;
  let dr = 0;
  let dc = 0;
  if (cell.link === Link.U) dr = 1;
  if (cell.link === Link.D) dr = -1;
  if (cell.link === Link.R) dc = 1;
  if (cell.link === Link.L) dc = -1;
  const pr = r + dr;
  const pc = c + dc;
  const partner = board.get(pr, pc);
  if (!partner || partner.kind !== Kind.SEGMENT || partner.pillId !== cell.pillId) return;
  partner.link = Link.NONE;
  board.set(pr, pc, partner);
}

function clearCells(board, clearSet) {
  for (const k of clearSet) {
    const r = Math.floor(k / 100);
    const c = k % 100;
    const cell = board.get(r, c);
    if (!cell || cell.kind === Kind.EMPTY) continue;
    breakPartnerLink(board, r, c, cell);
  }

  let clearedViruses = 0;
  for (const k of clearSet) {
    const r = Math.floor(k / 100);
    const c = k % 100;
    const cell = board.get(r, c);
    if (!cell || cell.kind === Kind.EMPTY) continue;
    if (cell.kind === Kind.VIRUS) clearedViruses += 1;
    board.set(r, c, makeEmptyCell());
  }

  return clearedViruses;
}

function canFallSingle(board, r, c) {
  return r > 0 && board.isEmpty(r - 1, c);
}

function settleOnce(board) {
  let moved = false;
  for (let r = 1; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = board.get(r, c);
      if (!cell || cell.kind !== Kind.SEGMENT) continue;
      if (cell.link === Link.L || cell.link === Link.D) continue;

      if (!cell.link) {
        if (canFallSingle(board, r, c)) {
          board.set(r - 1, c, cell);
          board.set(r, c, makeEmptyCell());
          moved = true;
        }
        continue;
      }

      if (cell.link === Link.R) {
        const other = board.get(r, c + 1);
        if (!other || other.kind !== Kind.SEGMENT || other.pillId !== cell.pillId) {
          cell.link = Link.NONE;
          board.set(r, c, cell);
          continue;
        }
        const leftCan = r > 0 && board.isEmpty(r - 1, c);
        const rightCan = r > 0 && board.isEmpty(r - 1, c + 1);
        if (leftCan && rightCan) {
          board.set(r - 1, c, cell);
          board.set(r - 1, c + 1, other);
          board.set(r, c, makeEmptyCell());
          board.set(r, c + 1, makeEmptyCell());
          moved = true;
        } else if (leftCan !== rightCan) {
          cell.link = Link.NONE;
          other.link = Link.NONE;
          board.set(r, c, cell);
          board.set(r, c + 1, other);
        }
        continue;
      }

      if (cell.link === Link.U) {
        const other = board.get(r + 1, c);
        if (!other || other.kind !== Kind.SEGMENT || other.pillId !== cell.pillId) {
          cell.link = Link.NONE;
          board.set(r, c, cell);
          continue;
        }
        if (r > 0 && board.isEmpty(r - 1, c)) {
          board.set(r - 1, c, cell);
          board.set(r, c, other);
          board.set(r + 1, c, makeEmptyCell());
          moved = true;
        }
      }
    }
  }
  return moved;
}

function settleAll(board) {
  while (settleOnce(board)) {
    // Keep settling until stable.
  }
}

function scoreViruses(speed, virusCount) {
  const v = Math.max(0, Math.min(6, virusCount | 0));
  return VIRUS_POINTS[speed][v];
}

function resolveBoard() {
  let chain = 0;
  let lastViruses = 0;

  while (true) {
    const matches = findMatches(game.board);
    if (matches.size === 0) break;
    chain += 1;
    lastViruses = clearCells(game.board, matches);
    if (lastViruses > 0) {
      const points = scoreViruses(game.speed, lastViruses);
      game.score += points;
      game.virusesRemaining = Math.max(0, game.virusesRemaining - lastViruses);
      game.status = `Cleared ${lastViruses} virus${lastViruses === 1 ? '' : 'es'} +${points}`;
    } else {
      game.status = chain > 1 ? `Chain x${chain}` : 'Match cleared';
    }
    settleAll(game.board);
  }

  if (game.virusesRemaining === 0) {
    game.state = GameState.STAGE_CLEAR;
    game.timers.stageClearRemaining = 1200;
    game.status = 'Stage clear!';
    return;
  }

  game.state = GameState.SPAWN;
}

function generateViruses(count) {
  const maxRow = Math.min(VISIBLE_H - 1, 6 + Math.floor(count / 6));
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 20000) {
    const r = game.rng.int(maxRow + 1);
    const c = game.rng.int(W);
    if (!game.board.isEmpty(r, c)) continue;
    const color = rollColor3(game.rng);
    game.board.set(r, c, { kind: Kind.VIRUS, color, pillId: null, link: Link.NONE });
    if (findMatches(game.board).size > 0) {
      game.board.set(r, c, makeEmptyCell());
      continue;
    }
    placed += 1;
  }
}

function startStage(level) {
  resetBoard();
  game.active = null;
  game.pillId = 1;
  game.state = GameState.SPAWN;
  game.timers.gravityElapsed = 0;
  game.timers.stageClearRemaining = 0;
  const virusCount = Math.min(84, (level + 1) * 4);
  game.virusLevel = level;
  game.virusesRemaining = virusCount;
  generateViruses(virusCount);
  game.nextSpec = rollCapsuleSpec(game.rng);
  game.status = `Stage ${level + 1}`;
}

function newGame() {
  const seed = (Date.now() >>> 0) ^ (Math.random() * 0xffffffff);
  game.rng = makeRng(seed);
  game.score = 0;
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.paused = false;
  game.input.held.left = false;
  game.input.held.right = false;
  game.input.held.down = false;
  game.input.clearPressed();
  game.repeat.left = -DAS;
  game.repeat.right = -DAS;
  pauseBtn.textContent = 'Pause';
  game.speed = speedSelect.value;
  startStage(0);
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  virusesEl.textContent = game.virusesRemaining.toString();
  levelEl.textContent = (game.virusLevel + 1).toString();
  speedLabelEl.textContent = game.speed;
  statusEl.textContent = game.paused ? 'Paused' : game.status;
}

function setupView() {
  view.boardWidth = W * view.cellSize;
  view.boardHeight = VISIBLE_H * view.cellSize;
  view.boardLeft = Math.floor((canvas.width - view.boardWidth) / 2);
  view.boardTop = Math.floor((canvas.height - view.boardHeight) / 2);
}

function cellToX(col) {
  return view.boardLeft + col * view.cellSize;
}

function cellToY(row) {
  return view.boardTop + (VISIBLE_H - 1 - row) * view.cellSize;
}

function roundRect(ctxRef, x, y, w, h, r, corners) {
  const tl = corners.tl ? r : 0;
  const tr = corners.tr ? r : 0;
  const br = corners.br ? r : 0;
  const bl = corners.bl ? r : 0;

  ctxRef.beginPath();
  ctxRef.moveTo(x + tl, y);
  ctxRef.lineTo(x + w - tr, y);
  if (tr) ctxRef.arcTo(x + w, y, x + w, y + tr, tr);
  else ctxRef.lineTo(x + w, y);
  ctxRef.lineTo(x + w, y + h - br);
  if (br) ctxRef.arcTo(x + w, y + h, x + w - br, y + h, br);
  else ctxRef.lineTo(x + w, y + h);
  ctxRef.lineTo(x + bl, y + h);
  if (bl) ctxRef.arcTo(x, y + h, x, y + h - bl, bl);
  else ctxRef.lineTo(x, y + h);
  ctxRef.lineTo(x, y + tl);
  if (tl) ctxRef.arcTo(x, y, x + tl, y, tl);
  else ctxRef.lineTo(x, y);
  ctxRef.closePath();
}

function segmentCorners(link) {
  const corners = { tl: true, tr: true, br: true, bl: true };
  if (link === Link.R) {
    corners.tr = false;
    corners.br = false;
  } else if (link === Link.L) {
    corners.tl = false;
    corners.bl = false;
  } else if (link === Link.U) {
    corners.tl = false;
    corners.tr = false;
  } else if (link === Link.D) {
    corners.bl = false;
    corners.br = false;
  }
  return corners;
}

function drawSegment(ctxRef, x, y, s, colorKey, link) {
  const palette = PALETTE[colorKey];
  const grad = ctxRef.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.55, palette.base);
  grad.addColorStop(1, palette.dark);
  const r = s * 0.28;
  roundRect(ctxRef, x + 1, y + 1, s - 2, s - 2, r, segmentCorners(link));
  ctxRef.fillStyle = grad;
  ctxRef.fill();
  ctxRef.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctxRef.lineWidth = Math.max(1, s * 0.06);
  ctxRef.stroke();
}

function drawVirus(ctxRef, x, y, s, colorKey) {
  const palette = PALETTE[colorKey];
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.42;
  const grad = ctxRef.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.2, cx, cy, r);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.6, palette.base);
  grad.addColorStop(1, palette.dark);
  ctxRef.beginPath();
  ctxRef.arc(cx, cy, r, 0, Math.PI * 2);
  ctxRef.fillStyle = grad;
  ctxRef.fill();
  ctxRef.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctxRef.lineWidth = Math.max(1, s * 0.06);
  ctxRef.stroke();
  ctxRef.save();
  ctxRef.globalAlpha = 0.18;
  ctxRef.fillStyle = palette.dark;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    ctxRef.beginPath();
    ctxRef.arc(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.25, r * 0.12, 0, Math.PI * 2);
    ctxRef.fill();
  }
  ctxRef.restore();
}

function drawBoard(alpha) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(view.boardLeft, view.boardTop, view.boardLeft, view.boardTop + view.boardHeight);
  bg.addColorStop(0, '#121a2d');
  bg.addColorStop(1, '#0b1326');
  ctx.fillStyle = bg;
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 14, {
    tl: true,
    tr: true,
    br: true,
    bl: true,
  });
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight, 14, {
    tl: true,
    tr: true,
    br: true,
    bl: true,
  });
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
  for (let r = 1; r < VISIBLE_H; r++) {
    const y = view.boardTop + r * view.cellSize;
    ctx.beginPath();
    ctx.moveTo(view.boardLeft, y);
    ctx.lineTo(view.boardLeft + view.boardWidth, y);
    ctx.stroke();
  }

  for (let r = 0; r < VISIBLE_H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = game.board.get(r, c);
      if (!cell || cell.kind === Kind.EMPTY) continue;
      const x = cellToX(c);
      const y = cellToY(r);
      if (cell.kind === Kind.VIRUS) {
        drawVirus(ctx, x, y, view.cellSize, cell.color);
      } else {
        drawSegment(ctx, x, y, view.cellSize, cell.color, cell.link);
      }
    }
  }

  if (game.active) {
    const offset = getFallOffset(alpha);
    const cells = activeCells(game.active);
    for (const cell of cells) {
      if (cell.r < 0 || cell.r >= VISIBLE_H) continue;
      const x = cellToX(cell.c);
      const y = cellToY(cell.r) + offset;
      const link = cell.which === 'A'
        ? (game.active.orient === 0 ? Link.R : Link.U)
        : (game.active.orient === 0 ? Link.L : Link.D);
      drawSegment(ctx, x, y, view.cellSize, cell.color, link);
    }
  }

  if (game.paused || game.state === GameState.GAME_OVER || game.state === GameState.STAGE_CLEAR) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(view.boardLeft, view.boardTop, view.boardWidth, view.boardHeight);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px Trebuchet MS, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let label = 'Paused';
    if (game.state === GameState.GAME_OVER) label = 'Game Over';
    if (game.state === GameState.STAGE_CLEAR) label = 'Stage Clear';
    ctx.fillText(label, view.boardLeft + view.boardWidth / 2, view.boardTop + view.boardHeight / 2);
    ctx.restore();
  }
}

function drawNextCapsule() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!game.nextSpec) return;
  const size = 32;
  const x = nextCanvas.width / 2 - size;
  const y = nextCanvas.height / 2 - size / 2;
  drawSegment(nextCtx, x, y, size, game.nextSpec.aColor, Link.R);
  drawSegment(nextCtx, x + size, y, size, game.nextSpec.bColor, Link.L);
}

function getFallOffset(alpha) {
  if (!game.active || game.state !== GameState.FALLING) return 0;
  const interval = gravityInterval();
  if (!canPlaceActive(game.active.aRow - 1, game.active.aCol, game.active.orient)) return 0;
  const blend = alpha === undefined ? 0 : alpha;
  const t = Math.min(1, (game.timers.gravityElapsed + blend * FIXED_DT) / interval);
  return t * view.cellSize;
}

function draw(alpha) {
  drawBoard(alpha);
  drawNextCapsule();
  updateHud();
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

  if (game.state === GameState.STAGE_CLEAR) {
    game.timers.stageClearRemaining -= dt;
    if (game.timers.stageClearRemaining <= 0) {
      const nextLevel = Math.min(20, game.virusLevel + 1);
      startStage(nextLevel);
    }
    game.input.clearPressed();
    return;
  }

  if (game.state === GameState.SPAWN) {
    spawnCapsule();
  } else if (game.state === GameState.FALLING) {
    stepFalling(dt);
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard();
  }

  game.input.clearPressed();
}

function togglePause() {
  if (game.state === GameState.GAME_OVER || game.state === GameState.STAGE_CLEAR) return;
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
      tryMoveActive(0, -1);
      game.repeat.left = -DAS;
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      tryMoveActive(0, 1);
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
    game.input.pressed.rotate = true;
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
speedSelect.addEventListener('change', () => {
  game.speed = speedSelect.value;
  newGame();
});

setupView();
newGame();
loop();
