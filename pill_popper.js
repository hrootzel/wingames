import { SfxEngine } from './sfx_engine.js';
import { BANK_PILLPOPPER } from './sfx_bank_pill_popper.js';
import { roundRect } from './rendering_engine.js';
import { drawSegment, drawVirus } from './pill_popper_sprite.js';
import { initGameShell } from './game-shell.js';

const W = 8;
const H = 16;
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

const ORIENT_OFFSETS = [
  { a: { dr: 0, dc: 0 }, b: { dr: 0, dc: 1 } },
  { a: { dr: 1, dc: 0 }, b: { dr: 0, dc: 0 } },
  { a: { dr: 0, dc: 1 }, b: { dr: 0, dc: 0 } },
  { a: { dr: 0, dc: 0 }, b: { dr: 1, dc: 0 } },
];

const PALETTE = {
  R: { base: '#ef4444', light: '#fecaca', dark: '#b91c1c' },
  B: { base: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' },
  Y: { base: '#facc15', light: '#fef3c7', dark: '#d97706' },
};

const COLOR_KEYS = ['Y', 'R', 'B'];
const COLOR_TO_INDEX = { Y: 0, R: 1, B: 2 };

const COARSE_SPEED = {
  LOW: 15,
  MED: 25,
  HI: 31,
};

const SPEED_TABLE_NTSC = [
  69, 67, 65, 63, 61, 59, 57, 55, 53, 51, 49, 47, 45, 43, 41, 39,
  37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 18, 17, 16, 15, 14, 13,
  12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3,
  3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  0,
];

const SPEED_UP_MAX = 49;
const DAS_FRAMES = 16;
const ARR_FRAMES = 6;
const FAST_DROP_MASK = 1;

const PILL_RESERVE_SIZE = 128;
const PILL_COMBO_LEFT = [0, 0, 0, 1, 1, 1, 2, 2, 2];
const PILL_COMBO_RIGHT = [0, 1, 2, 0, 1, 2, 0, 1, 2];
const VIRUS_COLOR_RANDOM = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1];
const VIRUS_COLOR_BITS = [1, 2, 4];
const VIRUS_MAX_HEIGHT = [
  9, 9, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 9, 9, 9, 10,
  10, 11, 11, 12, 12, 12, 12, 12,
  12, 12, 12, 12, 12, 12, 12, 12,
  12, 12, 12,
];

const SCORE_MULTIPLIER = [1, 2, 4, 8, 16, 32, 32, 32, 32, 32, 32];
const BASE_SCORE = { LOW: 100, MED: 200, HI: 300 };

const FIXED_DT = 1000 / 60;
const RESOLVE_DROP_INTERVAL = 60;
const MAX_START_STAGE = 20;

const STORAGE = {
  speed: 'pill_popper.speed',
  startStage: 'pill_popper.startStage',
};

const DEFAULT_SETTINGS = {
  speed: Speed.MED,
  startStage: 0,
};

const canvas = document.getElementById('pill-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const virusesEl = document.getElementById('viruses');
const levelEl = document.getElementById('level');
const speedLabelEl = document.getElementById('speed-label');
const statusEl = document.getElementById('status');
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const speedSelect = document.getElementById('speed');
const startStageInput = document.getElementById('start-stage');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');

const sfx = new SfxEngine({ master: 0.6 });
let audioUnlocked = false;

const view = {
  cellSize: 32,
  boardLeft: 0,
  boardTop: 0,
  boardWidth: 0,
  boardHeight: 0,
};

const game = makeGame();
let settings = loadSettings();

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

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeSettings(next) {
  const speed = Speed[next.speed] ? next.speed : DEFAULT_SETTINGS.speed;
  const startStage = clamp(
    toNumber(next.startStage, DEFAULT_SETTINGS.startStage),
    0,
    MAX_START_STAGE
  );
  return { speed, startStage };
}

function loadSettings() {
  const speed = localStorage.getItem(STORAGE.speed) ?? DEFAULT_SETTINGS.speed;
  const startStage = toNumber(localStorage.getItem(STORAGE.startStage), DEFAULT_SETTINGS.startStage);
  return sanitizeSettings({ speed, startStage });
}

function saveSettings(next) {
  localStorage.setItem(STORAGE.speed, next.speed);
  localStorage.setItem(STORAGE.startStage, String(next.startStage));
}

function syncSettingsUI(next) {
  if (speedSelect) speedSelect.value = next.speed;
  if (startStageInput) {
    startStageInput.max = String(MAX_START_STAGE + 1);
    startStageInput.value = String(next.startStage + 1);
  }
}

function applySettingsFromUI() {
  const startStageValue = toNumber(startStageInput.value, DEFAULT_SETTINGS.startStage + 1);
  const startStageIndex = clamp(Math.round(startStageValue) - 1, 0, MAX_START_STAGE);
  const next = sanitizeSettings({
    speed: speedSelect.value,
    startStage: startStageIndex,
  });
  settings = next;
  saveSettings(settings);
  syncSettingsUI(settings);
  newGame();
  return true;
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
    horVelocity: 0,
    state: GameState.SPAWN,
    paused: false,
    active: null,
    nextSpec: null,
    pillId: 1,
    pillReserve: [],
    pillReserveIndex: 0,
    pillsPlaced: 0,
    speedUps: 0,
    speedCounter: 0,
    frame: 0,
    scoreMultiplier: 0,
    score: 0,
    virusLevel: 0,
    virusesRemaining: 0,
    speed: Speed.MED,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    timers: { stageClearRemaining: 0 },
    resolve: null,
  };
}

function resetBoard() {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      game.board.cells[r][c] = makeEmptyCell();
    }
  }
}

function colorKeyFromIndex(index) {
  return COLOR_KEYS[index] ?? COLOR_KEYS[0];
}

function colorIndexFromKey(key) {
  return COLOR_TO_INDEX[key] ?? 0;
}

function generatePillReserve(rng) {
  const reserve = Array(PILL_RESERVE_SIZE);
  let pillId = 0;
  for (let i = PILL_RESERVE_SIZE - 1; i >= 0; i--) {
    pillId = (pillId + (rng.int(256) & 0x0f)) % PILL_COMBO_LEFT.length;
    reserve[i] = pillId;
  }
  return reserve;
}

function nextCapsuleSpec() {
  if (!game.pillReserve || game.pillReserve.length !== PILL_RESERVE_SIZE) {
    game.pillReserve = generatePillReserve(game.rng);
    game.pillReserveIndex = 0;
  }
  const id = game.pillReserve[game.pillReserveIndex];
  game.pillReserveIndex = (game.pillReserveIndex + 1) % PILL_RESERVE_SIZE;
  return {
    aColor: colorKeyFromIndex(PILL_COMBO_LEFT[id]),
    bColor: colorKeyFromIndex(PILL_COMBO_RIGHT[id]),
  };
}

function makeActiveCapsule(spec) {
  return {
    aRow: H - 1,
    aCol: 3,
    orient: 0,
    aColor: spec.aColor,
    bColor: spec.bColor,
  };
}

function linksForOrient(orient) {
  switch (orient & 3) {
    case 0:
      return { aLink: Link.R, bLink: Link.L };
    case 1:
      return { aLink: Link.D, bLink: Link.U };
    case 2:
      return { aLink: Link.L, bLink: Link.R };
    case 3:
      return { aLink: Link.U, bLink: Link.D };
    default:
      return { aLink: Link.R, bLink: Link.L };
  }
}

function activeCells(active, orientOverride, colOverride, rowOverride) {
  const orient = orientOverride === undefined ? active.orient : orientOverride;
  const aRow = rowOverride === undefined ? active.aRow : rowOverride;
  const aCol = colOverride === undefined ? active.aCol : colOverride;
  const choice = ORIENT_OFFSETS[orient & 3] || ORIENT_OFFSETS[0];
  return [
    { r: aRow + choice.a.dr, c: aCol + choice.a.dc, color: active.aColor, which: 'A' },
    { r: aRow + choice.b.dr, c: aCol + choice.b.dc, color: active.bColor, which: 'B' },
  ];
}

function canPlaceActive(aRow, aCol, orient) {
  const cells = activeCells(game.active, orient, aCol, aRow);
  for (const cell of cells) {
    if (!game.board.inBounds(cell.r, cell.c)) return false;
    if (!game.board.isEmpty(cell.r, cell.c)) return false;
  }
  return true;
}

function tryMoveActiveWithReason(dr, dc) {
  if (!game.active) return { ok: false, blockedByWall: false };
  const nextRow = game.active.aRow + dr;
  const nextCol = game.active.aCol + dc;
  const cells = activeCells(game.active, game.active.orient, nextCol, nextRow);
  for (const cell of cells) {
    if (!game.board.inBounds(cell.r, cell.c)) return { ok: false, blockedByWall: true };
    if (!game.board.isEmpty(cell.r, cell.c)) return { ok: false, blockedByWall: false };
  }
  game.active.aRow = nextRow;
  game.active.aCol = nextCol;
  return { ok: true, blockedByWall: false };
}

function tryMoveActive(dr, dc) {
  return tryMoveActiveWithReason(dr, dc).ok;
}

function tryRotate(dir) {
  if (!game.active) return false;
  const prevOrient = game.active.orient;
  const nextOrient = (prevOrient + dir + 4) & 3;
  const nextRow = game.active.aRow;
  const nextCol = game.active.aCol;
  const wasVertical = (prevOrient & 1) === 1;
  const willBeHorizontal = (nextOrient & 1) === 0;

  if (canPlaceActive(nextRow, nextCol, nextOrient)) {
    game.active.orient = nextOrient;
    if (wasVertical && willBeHorizontal && game.input.held.left) {
      const leftCol = nextCol - 1;
      if (canPlaceActive(nextRow, leftCol, nextOrient)) {
        game.active.aCol = leftCol;
      }
    }
    return true;
  }

  if (wasVertical && willBeHorizontal) {
    const kickCol = nextCol - 1;
    if (canPlaceActive(nextRow, kickCol, nextOrient)) {
      game.active.aCol = kickCol;
      game.active.orient = nextOrient;
      return true;
    }
  }
  return false;
}

function gravityFrames() {
  const coarse = COARSE_SPEED[game.speed] ?? COARSE_SPEED.MED;
  const fine = Math.min(SPEED_UP_MAX, game.speedUps);
  const index = Math.min(SPEED_TABLE_NTSC.length - 1, coarse + fine);
  return SPEED_TABLE_NTSC[index];
}

function updateSpeedUps() {
  if (game.speedUps >= SPEED_UP_MAX) return;
  if (game.pillsPlaced === 8 || (game.pillsPlaced > 8 && (game.pillsPlaced - 8) % 10 === 0)) {
    game.speedUps = Math.min(SPEED_UP_MAX, game.speedUps + 1);
    sfx.play(BANK_PILLPOPPER, 'speedUp');
  }
}

function spawnCapsule() {
  game.nextSpec = game.nextSpec || nextCapsuleSpec();
  game.active = makeActiveCapsule(game.nextSpec);
  game.nextSpec = nextCapsuleSpec();
  if (!canPlaceActive(game.active.aRow, game.active.aCol, game.active.orient)) {
    game.state = GameState.GAME_OVER;
    game.status = 'Game over. Press R to restart.';
    sfx.play(BANK_PILLPOPPER, 'gameOver');
    return;
  }
  game.state = GameState.FALLING;
  game.speedCounter = 0;
  game.horVelocity = 0;
}

function lockCapsule() {
  const active = game.active;
  if (!active) return;
  sfx.play(BANK_PILLPOPPER, 'lock');
  const cells = activeCells(active);
  const id = game.pillId++;
  const { aLink, bLink } = linksForOrient(active.orient);

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

  game.pillsPlaced += 1;
  updateSpeedUps();
  game.scoreMultiplier = 0;
  game.active = null;
  game.state = GameState.RESOLVE;
  game.resolve = { chain: 0, settling: false, settleTimer: 0 };
}

function handleHorizontalRepeat() {
  const heldLeft = game.input.held.left;
  const heldRight = game.input.held.right;
  if (!heldLeft && !heldRight) {
    game.horVelocity = 0;
    return;
  }

  game.horVelocity += 1;
  if (game.horVelocity < DAS_FRAMES) return;

  game.horVelocity = DAS_FRAMES - ARR_FRAMES;
  let blockedByPiece = false;
  if (heldRight) {
    const result = tryMoveActiveWithReason(0, 1);
    if (result.ok) {
      sfx.play(BANK_PILLPOPPER, 'move');
    } else if (!result.blockedByWall) {
      blockedByPiece = true;
    }
  }
  if (heldLeft) {
    const result = tryMoveActiveWithReason(0, -1);
    if (result.ok) {
      sfx.play(BANK_PILLPOPPER, 'move');
    } else if (!result.blockedByWall) {
      blockedByPiece = true;
    }
  }

  if (blockedByPiece) {
    game.horVelocity = DAS_FRAMES - 1;
  }
}

function stepFalling() {
  if (!game.active) {
    game.state = GameState.SPAWN;
    return;
  }

  game.frame = (game.frame + 1) | 0;

  if (game.input.pressed.hardDrop) {
    let guard = 0;
    while (tryMoveActive(-1, 0) && guard < H) {
      guard += 1;
    }
    sfx.play(BANK_PILLPOPPER, 'hardDrop');
    lockCapsule();
    return;
  }

  const downOnly = game.input.held.down && !game.input.held.left && !game.input.held.right;
  const checkFastDrop = (game.frame & FAST_DROP_MASK) !== 0;
  if (checkFastDrop && downOnly) {
    if (!tryMoveActive(-1, 0)) {
      lockCapsule();
      return;
    }
    game.speedCounter = 0;
  } else {
    game.speedCounter += 1;
    const frames = gravityFrames();
    if (game.speedCounter > frames) {
      if (!tryMoveActive(-1, 0)) {
        lockCapsule();
        return;
      }
      game.speedCounter = 0;
    }
  }

  handleHorizontalRepeat();

  if (game.input.pressed.rotate) {
    sfx.play(BANK_PILLPOPPER, 'rotate');
    tryRotate(-1);
  }
  if (game.input.pressed.rotateCCW) {
    sfx.play(BANK_PILLPOPPER, 'rotate');
    tryRotate(1);
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

function scoreVirusesCleared(virusCount) {
  let points = 0;
  const base = BASE_SCORE[game.speed] ?? BASE_SCORE.MED;
  for (let i = 0; i < virusCount; i++) {
    const index = Math.min(game.scoreMultiplier, SCORE_MULTIPLIER.length - 1);
    points += base * SCORE_MULTIPLIER[index];
    game.scoreMultiplier += 1;
  }
  return points;
}

function resolveBoard(dt) {
  const resolve = game.resolve || { chain: 0, settling: false, settleTimer: 0 };

  if (resolve.settling) {
    resolve.settleTimer += dt;
    while (resolve.settleTimer >= RESOLVE_DROP_INTERVAL) {
      const moved = settleOnce(game.board);
      if (moved) {
        sfx.play(BANK_PILLPOPPER, 'settle');
      }
      resolve.settleTimer -= RESOLVE_DROP_INTERVAL;
      if (!moved) {
        resolve.settling = false;
        break;
      }
    }
    game.resolve = resolve;
    if (resolve.settling) return;
  }

  const matches = findMatches(game.board);
  if (matches.size === 0) {
    if (game.virusesRemaining === 0) {
      game.state = GameState.STAGE_CLEAR;
      game.timers.stageClearRemaining = 1200;
      game.status = 'Stage clear!';
      sfx.play(BANK_PILLPOPPER, 'stageClear');
      game.resolve = null;
      return;
    }

    game.state = GameState.SPAWN;
    game.resolve = null;
    return;
  }

  resolve.chain += 1;
  const lastViruses = clearCells(game.board, matches);
  if (resolve.chain >= 2) {
    sfx.play(BANK_PILLPOPPER, 'chain', { chain: resolve.chain, chainIndex: resolve.chain });
  }
  if (lastViruses > 0) {
    sfx.play(BANK_PILLPOPPER, 'clearVirus', { viruses: lastViruses, chain: resolve.chain });
  } else {
    sfx.play(BANK_PILLPOPPER, 'clearPill', { chain: resolve.chain });
  }
  if (lastViruses > 0) {
    const points = scoreVirusesCleared(lastViruses);
    game.score += points;
    game.virusesRemaining = Math.max(0, game.virusesRemaining - lastViruses);
    game.status = `Cleared ${lastViruses} virus${lastViruses === 1 ? '' : 'es'} +${points}`;
  } else {
    game.status = resolve.chain > 1 ? `Chain x${resolve.chain}` : 'Match cleared';
  }
  resolve.settling = true;
  resolve.settleTimer = 0;
  game.resolve = resolve;
}

function virusNeighborMask(board, r, c) {
  const offsets = [
    { dr: 2, dc: 0 },
    { dr: -2, dc: 0 },
    { dr: 0, dc: 2 },
    { dr: 0, dc: -2 },
  ];
  let mask = 0;
  for (const { dr, dc } of offsets) {
    const cell = board.get(r + dr, c + dc);
    if (!cell || cell.kind !== Kind.VIRUS) continue;
    const index = colorIndexFromKey(cell.color);
    mask |= VIRUS_COLOR_BITS[index] || 0;
  }
  return mask;
}

function pickVirusColorIndex(remaining) {
  const forced = remaining & 3;
  if (forced < 3) return forced;
  return VIRUS_COLOR_RANDOM[game.rng.int(VIRUS_COLOR_RANDOM.length)];
}

function adjustVirusColorIndex(colorIndex, mask) {
  let current = colorIndex;
  for (let i = 0; i < 3; i++) {
    if ((mask & (VIRUS_COLOR_BITS[current] || 0)) === 0) return current;
    current = (current + 2) % 3;
  }
  return null;
}

function generateViruses(count) {
  const maxRow = VIRUS_MAX_HEIGHT[Math.min(game.virusLevel, VIRUS_MAX_HEIGHT.length - 1)];
  let remaining = count;
  let guard = 0;
  while (remaining > 0 && guard++ < 20000) {
    const r = game.rng.int(H);
    if (r > maxRow) continue;
    const c = game.rng.int(W);
    const startPos = r * W + c;
    let placed = false;
    for (let pos = startPos; pos < W * H; pos++) {
      const row = Math.floor(pos / W);
      const col = pos % W;
      if (!game.board.isEmpty(row, col)) continue;
      const mask = virusNeighborMask(game.board, row, col);
      if (mask === 0b111) continue;
      const initialColor = pickVirusColorIndex(remaining);
      const finalColor = adjustVirusColorIndex(initialColor, mask);
      if (finalColor === null) continue;
      game.board.set(row, col, {
        kind: Kind.VIRUS,
        color: colorKeyFromIndex(finalColor),
        pillId: null,
        link: Link.NONE,
      });
      placed = true;
      break;
    }
    if (placed) remaining -= 1;
  }
}

function startStage(level) {
  resetBoard();
  game.active = null;
  game.pillId = 1;
  game.state = GameState.SPAWN;
  game.horVelocity = 0;
  game.speedCounter = 0;
  game.speedUps = 0;
  game.pillsPlaced = 0;
  game.frame = 0;
  game.scoreMultiplier = 0;
  game.timers.stageClearRemaining = 0;
  game.resolve = null;
  game.pillReserve = generatePillReserve(game.rng);
  game.pillReserveIndex = 0;
  const virusCount = Math.min(84, (level + 1) * 4);
  game.virusLevel = level;
  game.virusesRemaining = virusCount;
  generateViruses(virusCount);
  game.nextSpec = nextCapsuleSpec();
  game.status = `Stage ${level + 1}`;
  sfx.play(BANK_PILLPOPPER, 'stageStart');
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
  game.horVelocity = 0;
  pauseBtn.textContent = 'Pause';
  game.speed = settings.speed;
  startStage(settings.startStage);
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  virusesEl.textContent = game.virusesRemaining.toString();
  levelEl.textContent = (game.virusLevel + 1).toString();
  speedLabelEl.textContent = game.speed;
  statusEl.textContent = game.paused ? 'Paused' : game.status;
}

function setupView() {
  const pad = 16;
  const cell = Math.floor(
    Math.min(
      (canvas.width - pad * 2) / W,
      (canvas.height - pad * 2) / VISIBLE_H
    )
  );
  view.cellSize = Math.max(8, cell);
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
        drawVirus(ctx, x, y, view.cellSize, cell.color, PALETTE);
      } else {
        drawSegment(ctx, x, y, view.cellSize, cell.color, cell.link, PALETTE);
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
      const { aLink, bLink } = linksForOrient(game.active.orient);
      const link = cell.which === 'A' ? aLink : bLink;
      drawSegment(ctx, x, y, view.cellSize, cell.color, link, PALETTE);
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
  drawSegment(nextCtx, x, y, size, game.nextSpec.aColor, Link.R, PALETTE);
  drawSegment(nextCtx, x + size, y, size, game.nextSpec.bColor, Link.L, PALETTE);
}

function getFallOffset(alpha) {
  if (!game.active || game.state !== GameState.FALLING) return 0;
  if (!canPlaceActive(game.active.aRow - 1, game.active.aCol, game.active.orient)) return 0;
  const blend = alpha === undefined ? 0 : alpha;
  const interval = gravityFrames() + 1;
  const t = Math.min(1, (game.speedCounter + blend) / interval);
  return t * view.cellSize;
}

function draw(alpha) {
  drawBoard(alpha);
  drawNextCapsule();
  updateHud();
}

function preventArrowScroll(ev) {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.key === 'ArrowDown' || ev.key === 'Down') {
    ev.preventDefault();
  }
}

function stepGame(dt) {
  if (game.state === GameState.GAME_OVER) {
    game.input.clearPressed();
    return;
  }
  if (game.paused || isSettingsOpen()) {
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
    stepFalling();
  } else if (game.state === GameState.RESOLVE) {
    resolveBoard(dt);
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
  if (isSettingsOpen()) return;
  if (key === 'arrowleft' || key === 'a') {
    if (!game.input.held.left) {
      game.input.held.left = true;
      game.horVelocity = 0;
      if (game.active) {
        tryMoveActive(0, -1);
        sfx.play(BANK_PILLPOPPER, 'move');
      }
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    if (!game.input.held.right) {
      game.input.held.right = true;
      game.horVelocity = 0;
      if (game.active) {
        tryMoveActive(0, 1);
        sfx.play(BANK_PILLPOPPER, 'move');
      }
    }
    ev.preventDefault();
    return;
  }
  if (key === 'arrowdown' || key === 's') {
    game.input.held.down = true;
    ev.preventDefault();
    return;
  }
  if (key === 'arrowup' || key === 'x' || key === 'w') {
    game.input.pressed.rotateCCW = true;
    ev.preventDefault();
    return;
  }
  if (key === 'z' || key === 'q') {
    game.input.pressed.rotate = true;
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
    if (!game.input.held.left && !game.input.held.right) {
      game.horVelocity = 0;
    }
    ev.preventDefault();
  }
  if (key === 'arrowright' || key === 'd') {
    game.input.held.right = false;
    if (!game.input.held.left && !game.input.held.right) {
      game.horVelocity = 0;
    }
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

document.addEventListener('keydown', preventArrowScroll, { passive: false });
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
newBtn.addEventListener('click', () => newGame());
pauseBtn.addEventListener('click', () => togglePause());
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
document.addEventListener('pointerdown', unlockAudio, { once: true });

syncSettingsUI(settings);
initGameShell({
  shellEl: '.pill-stage-area',
  surfaceEl: '#pill-surface',
  canvasEl: canvas,
  baseWidth: canvas.width,
  baseHeight: canvas.height,
  mode: 'fractional',
  fit: 'css',
  onResize: setupView,
});
newGame();
loop();
