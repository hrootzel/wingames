import { SfxEngine } from './sfx_engine.js';
import { BANK_COIN_CASCADE } from './sfx_bank_coin_cascade.js';
import { initGameShell } from './game-shell.js';

const COLS = 6;
const ROWS_VISIBLE = 12;
const ROWS_BUFFER = 0;
const ROWS = ROWS_VISIBLE + ROWS_BUFFER;
const VISIBLE_START = ROWS - ROWS_VISIBLE;

const CELL_EMPTY = 0;
const CELL_I = 1;
const CELL_V = 2;
const CELL_X = 3;
const CELL_L = 4;
const CELL_C = 5;
const CELL_D = 6;
const CELL_PLUS = 7;
const CELL_MINUS = 8;

const REQUIRE = [5, 2, 5, 2, 5, 2];
const DENOM = [1, 5, 10, 50, 100, 500];
const ROMAN_NUMERALS = ['I', 'V', 'X', 'L', 'C', 'D'];
const ARABIC_NUMERALS = ['1', '5', '10', '50', '100', '500'];
const BASE_DESCENT_MS = { 1: 1950, 2: 1775, 3: 1600, 4: 1450, 5: 1325, 6: 1200, 7: 1125, 8: 1050 };
const DIFF_LEVEL_SHIFT = { 1: -6, 2: -4, 3: -2, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8 };
const DIFF_PROGRESS_MULT = { 1: 0.85, 2: 0.9, 3: 0.95, 4: 1, 5: 1.05, 6: 1.1, 7: 1.15, 8: 1.2 };

const LEVEL_UP_THRESHOLD = 30;
const TIME_RATE = 1;
const CLEAR_RATE = 0.1;
const SPECIAL_RATE = 2;
const FIXED_DT = 1000 / 60;
const RESOLVE_STEP_MS = 120;
const MATCH_ANIM_MS = 220;
const POPUP_TTL_MS = 900;
const BANNER_TTL_MS = 820;

const STORAGE = {
  difficulty: 'coin_cascade.difficulty',
  audioEnabled: 'coin_cascade.audioEnabled',
  numeralMode: 'coin_cascade.numeralMode',
};

const DEFAULT_SETTINGS = {
  difficulty: 4,
  audioEnabled: true,
  numeralMode: 'roman',
};

const COIN_STYLE = [
  { ring: '#8f4f2d', center: '#c57a4f', hi: '#f6d7be', shadow: '#5f2f16', text: '#2f180c' },
  { ring: '#7d5a35', center: '#bf8b4e', hi: '#f0d1a4', shadow: '#543518', text: '#2a1a0d' },
  { ring: '#7a818b', center: '#b9c2cf', hi: '#f7fafc', shadow: '#4f5560', text: '#1f2733' },
  { ring: '#c69f4f', center: '#c4c7ca', hi: '#fff4d4', shadow: '#7a6947', text: '#2c2a25' },
  { ring: '#ba8e1d', center: '#ebc74c', hi: '#fff1ab', shadow: '#6f500e', text: '#2e220a' },
  { ring: '#b8c4d4', center: '#e4edf8', hi: '#ffffff', shadow: '#748192', text: '#1f2e3e' },
];

const canvas = document.getElementById('cascade-canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const chainEl = document.getElementById('chain');
const maxChainEl = document.getElementById('max-chain');
const difficultyLabelEl = document.getElementById('difficulty-label');
const speedLabelEl = document.getElementById('speed-label');
const clearedEl = document.getElementById('cleared');
const statusEl = document.getElementById('status');
const newBtn = document.getElementById('new-game');
const pauseBtn = document.getElementById('pause');
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const difficultyInput = document.getElementById('difficulty');
const numeralModeSelect = document.getElementById('numeral-mode');
const audioEnabledSelect = document.getElementById('audio-enabled');

const sfx = new SfxEngine({ master: 0.62 });
let audioUnlocked = false;

const view = {
  cellSize: 44,
  originX: 0,
  originY: 0,
  fieldW: 0,
  fieldH: 0,
  launcherY: 0,
};

const game = makeGame();
let settings = loadSettings();

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

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isCoin(cell) {
  return cell >= CELL_I && cell <= CELL_D;
}

function tierOf(cell) {
  return isCoin(cell) ? cell - 1 : null;
}

function cellOfTier(tier) {
  return CELL_I + tier;
}

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_EMPTY));
}

function makeGame() {
  const seed = (Date.now() >>> 0) ^ ((Math.random() * 0xffffffff) >>> 0);
  return {
    rng: makeRng(seed),
    board: makeBoard(),
    hand: { col: 0, stack: [] },
    score: 0,
    level: 1,
    levelProgress: 0,
    chainsTotal: 0,
    maxChain: 0,
    lastChain: 0,
    coinsCleared: 0,
    paused: false,
    gameOver: false,
    resolving: false,
    resolve: null,
    status: 'Ready.',
    statusBeforePause: 'Ready.',
    timers: {
      descentElapsed: 0,
      actionCooldown: 0,
      dangerCooldown: 0,
    },
    fx: {
      phase: 0,
      pulse: 0,
      banners: [],
      scorePopups: [],
    },
  };
}

function sanitizeSettings(next) {
  const numeralMode = next.numeralMode === 'arabic' ? 'arabic' : 'roman';
  return {
    difficulty: clamp(Math.round(toNumber(next.difficulty, DEFAULT_SETTINGS.difficulty)), 1, 8),
    audioEnabled: next.audioEnabled !== false,
    numeralMode,
  };
}

function loadSettings() {
  const difficulty = toNumber(localStorage.getItem(STORAGE.difficulty), DEFAULT_SETTINGS.difficulty);
  const audioEnabled = localStorage.getItem(STORAGE.audioEnabled) !== 'false';
  const numeralMode = localStorage.getItem(STORAGE.numeralMode) ?? DEFAULT_SETTINGS.numeralMode;
  return sanitizeSettings({ difficulty, audioEnabled, numeralMode });
}

function saveSettings(next) {
  localStorage.setItem(STORAGE.difficulty, String(next.difficulty));
  localStorage.setItem(STORAGE.audioEnabled, next.audioEnabled ? 'true' : 'false');
  localStorage.setItem(STORAGE.numeralMode, next.numeralMode);
}

function syncSettingsUI(next) {
  if (difficultyInput) difficultyInput.value = String(next.difficulty);
  if (numeralModeSelect) numeralModeSelect.value = next.numeralMode;
  if (audioEnabledSelect) audioEnabledSelect.value = next.audioEnabled ? 'on' : 'off';
}

function applySettingsFromUI() {
  const next = sanitizeSettings({
    difficulty: difficultyInput.value,
    numeralMode: numeralModeSelect.value,
    audioEnabled: audioEnabledSelect.value === 'on',
  });
  settings = next;
  saveSettings(settings);
  syncSettingsUI(settings);
  sfx.setEnabled(settings.audioEnabled);
  newGame();
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

function descentIntervalMs(level, difficulty) {
  const base = BASE_DESCENT_MS[difficulty];
  const ms = base * Math.pow(0.97, level - 1);
  return Math.max(260, Math.floor(ms));
}

function actionCooldownMs(level) {
  return Math.max(60, 140 - level * 2);
}

function sampleTier(weights) {
  const r = game.rng.next();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r <= sum) return i;
  }
  return weights.length - 1;
}

function generateSpawnRow(level, difficulty) {
  const eff = level + DIFF_LEVEL_SHIFT[difficulty];
  let weights;
  if (eff <= 5) weights = [0.55, 0.25, 0.2, 0, 0, 0];
  else if (eff <= 12) weights = [0.4, 0.25, 0.25, 0.1, 0, 0];
  else if (eff <= 20) weights = [0.28, 0.22, 0.25, 0.18, 0.07, 0];
  else weights = [0.2, 0.18, 0.22, 0.2, 0.14, 0.06];

  const row = Array(COLS).fill(CELL_EMPTY);
  for (let c = 0; c < COLS; c++) {
    row[c] = cellOfTier(sampleTier(weights));
  }

  const pSpecial = Math.min(0.12, 0.03 + 0.002 * eff);
  if (game.rng.next() < pSpecial) {
    const col = game.rng.int(COLS);
    row[col] = game.rng.next() < 0.52 ? CELL_PLUS : CELL_MINUS;
  }
  return row;
}

function countOccupied(col) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) if (game.board[r][col] !== CELL_EMPTY) n++;
  return n;
}

function findBottomOccupiedRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (game.board[r][col] !== CELL_EMPTY) return r;
  }
  return -1;
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let write = 0;
    for (let r = 0; r < ROWS; r++) {
      const cell = game.board[r][c];
      if (cell !== CELL_EMPTY) {
        if (write !== r) {
          game.board[write][c] = cell;
          game.board[r][c] = CELL_EMPTY;
        }
        write++;
      }
    }
  }
}

function applyGravityWithMoves(activeSet = null) {
  const next = makeBoard();
  const moves = [];
  const nextActive = activeSet ? new Set() : null;
  for (let c = 0; c < COLS; c++) {
    let write = 0;
    for (let r = 0; r < ROWS; r++) {
      const cell = game.board[r][c];
      if (cell === CELL_EMPTY) continue;
      if (nextActive && activeSet.has(cellKey(r, c))) nextActive.add(cellKey(write, c));
      next[write][c] = cell;
      if (write !== r) moves.push({ cell, fromR: r, toR: write, c });
      write++;
    }
  }
  game.board = next;
  return { moves, activeSet: nextActive };
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function makeActiveSet(activeCells) {
  if (!Array.isArray(activeCells) || activeCells.length === 0) return null;
  const active = new Set();
  for (const cell of activeCells) {
    if (!Array.isArray(cell) || cell.length !== 2) continue;
    const [r, c] = cell;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    active.add(cellKey(r, c));
  }
  return active.size > 0 ? active : null;
}

function groupTouchesActive(group, activeSet) {
  if (!activeSet) return true;
  for (const [r, c] of group.cells) {
    if (activeSet.has(cellKey(r, c))) return true;
  }
  return false;
}

function rankUpAllOfTier(tier) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tierOf(game.board[r][c]) === tier) {
        count++;
        if (tier < 5) game.board[r][c] = cellOfTier(tier + 1);
        else game.board[r][c] = CELL_EMPTY;
      }
    }
  }
  return count;
}

function eraseAllOfTier(tier) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tierOf(game.board[r][c]) === tier) {
        game.board[r][c] = CELL_EMPTY;
        count++;
      }
    }
  }
  return count;
}

function activateSpecialsOnce(activeSet = null) {
  let changed = false;
  let scoreDelta = 0;
  let cleared = 0;
  let specialActivations = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = game.board[r][c];
      if (cell !== CELL_PLUS && cell !== CELL_MINUS) continue;
      if (activeSet && !activeSet.has(cellKey(r, c))) continue;

      let rr = r - 1;
      while (rr >= 0 && game.board[rr][c] === CELL_EMPTY) rr--;

      if (rr >= 0 && isCoin(game.board[rr][c])) {
        const tier = tierOf(game.board[rr][c]);
        let affected = 0;
        if (cell === CELL_PLUS) {
          affected = rankUpAllOfTier(tier);
          scoreDelta += DENOM[tier] * affected * 6;
          playSfx('plus');
        } else {
          affected = eraseAllOfTier(tier);
          cleared += affected;
          scoreDelta += DENOM[tier] * affected * 8;
          playSfx('minus');
        }
        changed = changed || affected > 0;
        specialActivations++;
      } else {
        playSfx('fizzle');
      }
      game.board[r][c] = CELL_EMPTY;
    }
  }

  return { changed, scoreDelta, cleared, specialActivations };
}

function findGroups() {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = game.board[r][c];
      if (!isCoin(cell) || visited[r][c]) continue;

      const tier = tierOf(cell);
      const stack = [[r, c]];
      visited[r][c] = true;
      const cells = [];

      while (stack.length) {
        const [rr, cc] = stack.pop();
        cells.push([rr, cc]);
        const neighbors = [
          [rr - 1, cc],
          [rr + 1, cc],
          [rr, cc - 1],
          [rr, cc + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (visited[nr][nc]) continue;
          if (game.board[nr][nc] === cell) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      groups.push({ tier, cells });
    }
  }
  return groups;
}

function selectUpgradeSpawn(cells) {
  let best = cells[0];
  for (const [r, c] of cells) {
    if (r > best[0] || (r === best[0] && c > best[1])) best = [r, c];
  }
  return best;
}

function findTopFreeRow(col) {
  for (let r = 0; r < ROWS; r++) {
    if (game.board[r][col] === CELL_EMPTY) return r;
  }
  return -1;
}

function applyScoreForStep(conversions, chainStep) {
  const chainMult = 1 + 0.5 * (chainStep - 1);
  let basePoints = 0;
  let anyDClear = false;

  for (const conv of conversions) {
    basePoints += DENOM[conv.tier] * conv.size;
    if (conv.tier === 5) anyDClear = true;
  }

  let stepPoints = Math.floor(basePoints * chainMult);
  if (anyDClear) stepPoints += 1000;
  return stepPoints;
}

function addBanner(text) {
  game.fx.banners.push({ text, life: BANNER_TTL_MS, ttl: BANNER_TTL_MS });
}

function addScorePopup(text, px, py) {
  game.fx.scorePopups.push({
    text,
    x: px,
    y: py,
    vy: -26,
    life: POPUP_TTL_MS,
    ttl: POPUP_TTL_MS,
  });
}

function updateProgressFromClear(coinCount, specialCount) {
  if (coinCount <= 0 && specialCount <= 0) return;
  const mult = DIFF_PROGRESS_MULT[settings.difficulty];
  game.levelProgress += coinCount * CLEAR_RATE * mult;
  game.levelProgress += specialCount * SPECIAL_RATE;
}

function maybeLevelUp() {
  let leveled = false;
  while (game.levelProgress >= LEVEL_UP_THRESHOLD) {
    game.levelProgress -= LEVEL_UP_THRESHOLD;
    game.level++;
    leveled = true;
  }
  if (leveled) {
    game.status = `Level ${game.level}!`;
    playSfx('levelUp');
  }
}

function finalizeResolve() {
  const resolve = game.resolve;
  if (!resolve) return;
  game.lastChain = resolve.chain;
  if (resolve.chain > 0) game.status = `Chain ${resolve.chain}!`;
  updateProgressFromClear(resolve.clearedInResolve, resolve.specialsInResolve);
  maybeLevelUp();
  game.resolve = null;
  game.resolving = false;
}

function processResolveStep() {
  const resolve = game.resolve;
  if (!resolve) return;
  if (resolve.anim) return;
  if (resolve.guard++ >= 64) {
    finalizeResolve();
    return;
  }

  if (resolve.useGravity) {
    const grav = applyGravityWithMoves(resolve.activeSet);
    if (resolve.activeSet) resolve.activeSet = grav.activeSet;
    const moves = grav.moves;
    if (moves.length > 0) {
      resolve.anim = {
        kind: 'gravity',
        moves,
        elapsed: 0,
        duration: RESOLVE_STEP_MS,
        targetSet: new Set(moves.map((m) => cellKey(m.toR, m.c))),
      };
      return;
    }
  }
  const specialResult = activateSpecialsOnce(resolve.activeSet);
  if (specialResult.scoreDelta > 0) {
    game.score += specialResult.scoreDelta;
    addScorePopup(`+${specialResult.scoreDelta}`, view.originX + view.fieldW * 0.5, view.originY + view.fieldH * 0.35);
  }
  resolve.clearedInResolve += specialResult.cleared;
  resolve.specialsInResolve += specialResult.specialActivations;

  const groups = findGroups();
  const toConvert = groups
    .map((g) => ({
      ...g,
      setSize: REQUIRE[g.tier],
    }))
    .filter((g) => g.cells.length >= g.setSize && groupTouchesActive(g, resolve.activeSet));
  if (toConvert.length === 0) {
    if (resolve.useGravity && specialResult.changed) applyGravity();
    finalizeResolve();
    return;
  }

  resolve.chain++;
  game.lastChain = resolve.chain;
  const clearMask = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const spawns = [];
  const conversions = [];
  const removedCells = [];

  for (const group of toConvert) {
    const sorted = group.cells.slice().sort((a, b) => {
      if (a[0] !== b[0]) return b[0] - a[0];
      return b[1] - a[1];
    });
    const activeInGroup = resolve.activeSet
      ? group.cells
          .filter(([r, c]) => resolve.activeSet.has(cellKey(r, c)))
          .sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]))
      : [];
    const consumed = sorted;
    for (const [r, c] of consumed) {
      clearMask[r][c] = true;
      removedCells.push([r, c]);
    }

    if (group.tier < 5) {
      const anchor = activeInGroup[0] ?? selectUpgradeSpawn(consumed);
      spawns.push({ r: anchor[0], c: anchor[1], cell: cellOfTier(group.tier + 1), sources: consumed });
    }
    conversions.push({ tier: group.tier, size: consumed.length });
  }

  let removedCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (clearMask[r][c]) {
        game.board[r][c] = CELL_EMPTY;
        removedCount++;
      }
    }
  }
  resolve.clearedInResolve += removedCount;
  game.coinsCleared += removedCount;

  const placedSpawns = [];
  for (const spawn of spawns) {
    let r = spawn.r;
    if (r < 0 || r >= ROWS || game.board[r][spawn.c] !== CELL_EMPTY) r = findTopFreeRow(spawn.c);
    if (r < 0) continue;
    game.board[r][spawn.c] = spawn.cell;
    placedSpawns.push({ r, c: spawn.c, cell: spawn.cell, sources: spawn.sources ?? [] });
  }
  if (resolve.activeSet) {
    resolve.activeSet = new Set(placedSpawns.map((s) => cellKey(s.r, s.c)));
    if (resolve.activeSet.size === 0) {
      finalizeResolve();
      return;
    }
  }

  const stepPoints = applyScoreForStep(conversions, resolve.chain);
  game.score += stepPoints;
  if (removedCells.length > 0) {
    let sumX = 0;
    let sumY = 0;
    for (const [r, c] of removedCells) {
      const p = gridToPx(r, c);
      sumX += p.x + view.cellSize * 0.5;
      sumY += p.y + view.cellSize * 0.5;
    }
    addScorePopup(`+${stepPoints}`, sumX / removedCells.length, sumY / removedCells.length);
  }
  if (resolve.chain >= 2) addBanner(`${resolve.chain} CHAIN`);
  game.status = `Chain ${resolve.chain}! +${stepPoints}`;
  playSfx(resolve.chain >= 2 || conversions.length >= 2 ? 'convertBig' : 'convertSmall');
  playSfx('chainStep', { chain: resolve.chain, groups: conversions.length });
  game.maxChain = Math.max(game.maxChain, resolve.chain);
  game.chainsTotal += 1;

  if (placedSpawns.length > 0 && removedCells.length > 0) {
    const fly = [];
    const hideSet = new Set();
    const particles = [];
    for (const spawn of placedSpawns) {
      const to = gridToPx(spawn.r, spawn.c);
      const toX = to.x + view.cellSize * 0.5;
      const toY = to.y + view.cellSize * 0.5;
      hideSet.add(cellKey(spawn.r, spawn.c));
      for (const [sr, sc] of spawn.sources) {
        const from = gridToPx(sr, sc);
        fly.push({
          cell: game.board[spawn.r][spawn.c],
          fromX: from.x + view.cellSize * 0.5,
          fromY: from.y + view.cellSize * 0.5,
          toX,
          toY,
        });
      }
      const pCount = 12;
      for (let i = 0; i < pCount; i++) {
        const a = (Math.PI * 2 * i) / pCount + game.rng.next() * 0.28;
        const speed = 16 + game.rng.next() * 44;
        particles.push({ x: toX, y: toY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1 });
      }
    }
    resolve.anim = { kind: 'match', elapsed: 0, duration: MATCH_ANIM_MS, fly, hideSet, particles };
  }
}

function resolveBoard(options = {}) {
  if (game.resolving || game.gameOver) return;
  game.resolve = {
    useGravity: options.applyGravity !== false,
    activeSet: makeActiveSet(options.activeCells),
    chain: 0,
    guard: 0,
    delay: 0,
    anim: null,
    clearedInResolve: 0,
    specialsInResolve: 0,
  };
  game.resolving = true;
}

function gameOver() {
  if (game.gameOver) return;
  game.gameOver = true;
  game.status = 'Game Over';
  playSfx('gameOver');
}

function descentStep() {
  if (game.gameOver) return;

  for (let c = 0; c < COLS; c++) {
    if (game.board[ROWS - 1][c] !== CELL_EMPTY) {
      gameOver();
      return;
    }
  }

  for (let r = ROWS - 2; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      game.board[r + 1][c] = game.board[r][c];
    }
  }

  const row = generateSpawnRow(game.level, settings.difficulty);
  for (let c = 0; c < COLS; c++) game.board[0][c] = row[c];

  playSfx('tick');
}

function grabFromColumn(col) {
  let r = findBottomOccupiedRow(col);
  if (r < 0) return false;
  const type = game.board[r][col];
  if (game.hand.stack.length > 0 && game.hand.stack[0] !== type) return false;

  let grabbed = 0;
  while (r >= 0 && game.board[r][col] === type) {
    game.hand.stack.push(type);
    game.board[r][col] = CELL_EMPTY;
    grabbed++;
    r--;
  }
  if (grabbed > 0) {
    game.status = `Grabbed x${grabbed}`;
    playSfx('grab');
    return true;
  }
  return false;
}

function throwToColumn(col) {
  if (game.hand.stack.length === 0) return false;
  applyGravity();
  const height = countOccupied(col);
  const startRow = height;
  if (startRow + game.hand.stack.length > ROWS) {
    gameOver();
    return false;
  }

  const placed = [];
  for (let i = 0; i < game.hand.stack.length; i++) {
    const r = startRow + i;
    game.board[r][col] = game.hand.stack[i];
    placed.push([r, col]);
  }
  game.hand.stack.length = 0;
  game.status = 'Thrown';
  playSfx('throw');
  playSfx('land');
  resolveBoard({ activeCells: placed });
  return true;
}

function doAction() {
  if (game.paused || game.gameOver || game.resolving || isSettingsOpen()) return;
  if (game.timers.actionCooldown > 0) return;

  let acted = false;
  if (game.hand.stack.length === 0) acted = grabFromColumn(game.hand.col);
  else acted = throwToColumn(game.hand.col);

  if (acted) game.timers.actionCooldown = actionCooldownMs(game.level);
}

function setColumnFromClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const logicalX = x * (canvas.width / rect.width);
  const col = clamp(Math.floor((logicalX - view.originX) / view.cellSize), 0, COLS - 1);
  if (col !== game.hand.col) {
    game.hand.col = col;
    playSfx('move');
  }
}

function togglePause() {
  if (game.gameOver) return;
  game.paused = !game.paused;
  pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
  if (game.paused) {
    game.statusBeforePause = game.status;
    game.status = 'Paused';
    playSfx('pause');
  } else {
    game.status = game.statusBeforePause || 'Ready.';
    playSfx('resume');
  }
}

function lowestOccupiedRow() {
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) if (game.board[r][c] !== CELL_EMPTY) return r;
  }
  return -1;
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  levelEl.textContent = String(game.level);
  chainEl.textContent = String(game.lastChain);
  maxChainEl.textContent = String(game.maxChain);
  difficultyLabelEl.textContent = String(settings.difficulty);
  speedLabelEl.textContent = `${descentIntervalMs(game.level, settings.difficulty)} ms`;
  clearedEl.textContent = String(game.coinsCleared);
  statusEl.textContent = game.status;
}

function resetBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) game.board[r][c] = CELL_EMPTY;
  }
}

function seedInitialRows() {
  for (let i = 0; i < 2; i++) {
    const row = generateSpawnRow(1, settings.difficulty);
    for (let c = 0; c < COLS; c++) {
      game.board[i][c] = row[c];
    }
  }
}

function resetGameState() {
  const seed = (Date.now() >>> 0) ^ ((Math.random() * 0xffffffff) >>> 0);
  game.rng = makeRng(seed);
  resetBoard();
  game.hand.col = Math.floor(COLS / 2);
  game.hand.stack.length = 0;
  game.score = 0;
  game.level = 1;
  game.levelProgress = 0;
  game.chainsTotal = 0;
  game.maxChain = 0;
  game.lastChain = 0;
  game.coinsCleared = 0;
  game.paused = false;
  game.gameOver = false;
  game.resolving = false;
  game.resolve = null;
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.timers.descentElapsed = 0;
  game.timers.actionCooldown = 0;
  game.timers.dangerCooldown = 0;
  game.fx.phase = 0;
  game.fx.pulse = 0;
  game.fx.banners.length = 0;
  game.fx.scorePopups.length = 0;
  pauseBtn.textContent = 'Pause';
  seedInitialRows();
}

function newGame() {
  resetGameState();
  game.status = 'Ready.';
  playSfx('start');
}

function playSfx(name, payload) {
  if (!settings.audioEnabled) return;
  sfx.play(BANK_COIN_CASCADE, name, payload);
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function setupView() {
  const sidePad = 52;
  const topPad = 108;
  const bottomPad = 114;
  view.cellSize = Math.floor(Math.min((canvas.width - sidePad * 2) / COLS, (canvas.height - topPad - bottomPad) / ROWS_VISIBLE));
  view.fieldW = view.cellSize * COLS;
  view.fieldH = view.cellSize * ROWS_VISIBLE;
  view.originX = Math.floor((canvas.width - view.fieldW) / 2);
  view.originY = topPad;
  view.launcherY = view.originY + view.fieldH + 38;
}

function gridToPx(r, c) {
  const vr = r - VISIBLE_START;
  return {
    x: view.originX + c * view.cellSize,
    y: view.originY + vr * view.cellSize,
  };
}

function drawCoin(x, y, size, tier) {
  const s = COIN_STYLE[tier];
  const r = size * 0.44;
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;

  const gOuter = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.28, r * 0.24, cx, cy, r);
  gOuter.addColorStop(0, s.hi);
  gOuter.addColorStop(0.62, s.center);
  gOuter.addColorStop(1, s.ring);
  ctx.fillStyle = gOuter;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = s.shadow;
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.arc(cx - r * 0.14, cy - r * 0.2, r * 0.66, Math.PI * 1.04, Math.PI * 1.82);
  ctx.stroke();

  const studs = REQUIRE[tier] === 5 ? 5 : 2;
  const studR = studs === 5 ? r * 0.095 : r * 0.13;
  for (let i = 0; i < studs; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / studs;
    const sx = cx + Math.cos(angle) * r * 0.77;
    const sy = cy + Math.sin(angle) * r * 0.77;
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.beginPath();
    ctx.arc(sx, sy, studR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(sx + studR * 0.2, sy + studR * 0.25, studR * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.floor(size * 0.35)}px "Trebuchet MS", "Segoe UI", sans-serif`;
  const numeralTable = settings.numeralMode === 'arabic' ? ARABIC_NUMERALS : ROMAN_NUMERALS;
  const numeral = numeralTable[tier];
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillText(numeral, cx + 1.4, cy + 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(numeral, cx - 0.9, cy - 0.8);
  ctx.strokeStyle = s.text;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeText(numeral, cx, cy);
}

function drawGem(x, y, size, isPlus) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  const hue = isPlus ? '80,170,255' : '255,96,96';
  const g = ctx.createRadialGradient(cx - size * 0.12, cy - size * 0.2, size * 0.05, cx, cy, size * 0.44);
  g.addColorStop(0, `rgba(${hue},0.85)`);
  g.addColorStop(0.56, `rgba(${hue},0.4)`);
  g.addColorStop(1, `rgba(${hue},0.12)`);

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.42);
  ctx.lineTo(cx + size * 0.36, cy);
  ctx.lineTo(cx, cy + size * 0.42);
  ctx.lineTo(cx - size * 0.36, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = isPlus ? 'rgba(160,220,255,0.85)' : 'rgba(255,170,170,0.85)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.52)';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, cy - size * 0.18);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.26);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = `700 ${Math.floor(size * 0.42)}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isPlus ? '+' : '-', cx, cy + 1);
}

function drawCell(r, c, cell) {
  const p = gridToPx(r, c);
  if (cell === CELL_PLUS) drawGem(p.x, p.y, view.cellSize, true);
  else if (cell === CELL_MINUS) drawGem(p.x, p.y, view.cellSize, false);
  else if (isCoin(cell)) drawCoin(p.x, p.y, view.cellSize, tierOf(cell));
}

function drawResolveAnimations() {
  const anim = game.resolve?.anim;
  if (!anim) return;
  const t = Math.max(0, Math.min(1, anim.elapsed / anim.duration));

  if (anim.kind === 'gravity') {
    const ease = 1 - (1 - t) * (1 - t);
    for (const m of anim.moves) {
      const rr = m.fromR + (m.toR - m.fromR) * ease;
      const p = gridToPx(rr, m.c);
      if (m.cell === CELL_PLUS) drawGem(p.x, p.y, view.cellSize, true);
      else if (m.cell === CELL_MINUS) drawGem(p.x, p.y, view.cellSize, false);
      else if (isCoin(m.cell)) drawCoin(p.x, p.y, view.cellSize, tierOf(m.cell));
    }
    return;
  }

  if (anim.kind === 'match') {
    const ease = 1 - Math.pow(1 - t, 3);
    for (const f of anim.fly) {
      const x = f.fromX + (f.toX - f.fromX) * ease - view.cellSize * 0.5;
      const y = f.fromY + (f.toY - f.fromY) * ease - view.cellSize * 0.5;
      ctx.globalAlpha = 1 - t * 0.9;
      if (f.cell === CELL_PLUS) drawGem(x, y, view.cellSize, true);
      else if (f.cell === CELL_MINUS) drawGem(x, y, view.cellSize, false);
      else if (isCoin(f.cell)) drawCoin(x, y, view.cellSize, tierOf(f.cell));
      ctx.globalAlpha = 1;
    }
    for (const p of anim.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = 'rgba(253,230,138,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#081b31');
  g.addColorStop(0.48, '#0d2f44');
  g.addColorStop(1, '#0a1f2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pulse = 0.5 + Math.sin(game.fx.phase * 0.7) * 0.5;
  ctx.fillStyle = `rgba(56,189,248,${0.04 + pulse * 0.03})`;
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.8, canvas.width * 0.46, canvas.height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawField() {
  const x = view.originX;
  const y = view.originY;
  const w = view.fieldW;
  const h = view.fieldH;

  ctx.fillStyle = 'rgba(3,10,20,0.78)';
  ctx.fillRect(x - 8, y - 8, w + 16, h + 16);

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(12,36,52,0.95)');
  g.addColorStop(1, 'rgba(7,17,29,0.96)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(148, 197, 241, 0.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    const gx = x + c * view.cellSize;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS_VISIBLE; r++) {
    const gy = y + r * view.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
}

function drawColumnHighlight() {
  const x = view.originX + game.hand.col * view.cellSize;
  ctx.fillStyle = 'rgba(56,189,248,0.14)';
  ctx.fillRect(x, view.originY, view.cellSize, view.fieldH);
  ctx.strokeStyle = 'rgba(125,211,252,0.38)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, view.originY + 1, view.cellSize - 2, view.fieldH - 2);

  if (game.hand.stack.length > 0) {
    const height = countOccupied(game.hand.col);
    const startRow = height;
    if (startRow + game.hand.stack.length <= ROWS) {
      for (let i = 0; i < game.hand.stack.length; i++) {
        const r = startRow + i;
        if (r < VISIBLE_START) continue;
        const p = gridToPx(r, game.hand.col);
        ctx.fillStyle = 'rgba(147,197,253,0.11)';
        ctx.fillRect(p.x + 4, p.y + 4, view.cellSize - 8, view.cellSize - 8);
      }
    }
  }
}

function drawHandAndLauncher() {
  const cx = view.originX + game.hand.col * view.cellSize + view.cellSize * 0.5;
  const by = view.launcherY;

  ctx.fillStyle = 'rgba(15,30,45,0.92)';
  ctx.beginPath();
  ctx.roundRect(cx - view.cellSize * 0.58, by - view.cellSize * 0.24, view.cellSize * 1.16, view.cellSize * 0.5, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,232,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(148,223,255,0.38)';
  ctx.beginPath();
  ctx.moveTo(cx - 8, by - view.cellSize * 0.22);
  ctx.lineTo(cx + 8, by - view.cellSize * 0.22);
  ctx.lineTo(cx, by - view.cellSize * 0.38);
  ctx.closePath();
  ctx.fill();

  const step = Math.max(14, view.cellSize * 0.58);
  for (let i = 0; i < game.hand.stack.length; i++) {
    const cell = game.hand.stack[i];
    const x = cx - view.cellSize * 0.5;
    const y = by - view.cellSize * 0.54 - i * step;
    if (cell === CELL_PLUS) drawGem(x, y, view.cellSize, true);
    else if (cell === CELL_MINUS) drawGem(x, y, view.cellSize, false);
    else drawCoin(x, y, view.cellSize, tierOf(cell));
  }
}

function drawTextOverlay() {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 19px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Lvl ${game.level}`, 20, 34);
  ctx.fillText(`Score ${game.score}`, 20, 62);

  ctx.textAlign = 'right';
  ctx.fillText(`Diff ${settings.difficulty}`, canvas.width - 20, 34);
  ctx.fillText(`Chain ${game.lastChain}`, canvas.width - 20, 62);

  if (game.paused || game.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(view.originX, view.originY, view.fieldW, view.fieldH);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.font = '700 44px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(game.gameOver ? 'GAME OVER' : 'PAUSED', canvas.width * 0.5, canvas.height * 0.46);
    ctx.font = '700 18px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('Press R to restart', canvas.width * 0.5, canvas.height * 0.52);
  }

  for (const b of game.fx.banners) {
    const t = b.life / b.ttl;
    ctx.globalAlpha = Math.max(0, Math.min(1, t));
    ctx.fillStyle = 'rgba(148,223,255,0.92)';
    ctx.strokeStyle = 'rgba(8,30,46,0.88)';
    ctx.lineWidth = 5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 30px "Trebuchet MS", "Segoe UI", sans-serif';
    const y = view.originY - 20 + (1 - t) * 14;
    ctx.strokeText(b.text, canvas.width * 0.5, y);
    ctx.fillText(b.text, canvas.width * 0.5, y);
    ctx.globalAlpha = 1;
  }

  for (const sp of game.fx.scorePopups) {
    const t = sp.life / sp.ttl;
    ctx.globalAlpha = Math.max(0, Math.min(1, t));
    ctx.fillStyle = 'rgba(255,243,180,0.95)';
    ctx.strokeStyle = 'rgba(40,24,6,0.9)';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.strokeText(sp.text, sp.x, sp.y);
    ctx.fillText(sp.text, sp.x, sp.y);
    ctx.globalAlpha = 1;
  }
}

function draw() {
  drawBackground();
  drawField();
  drawColumnHighlight();
  const anim = game.resolve?.anim ?? null;
  const animTargets = anim?.kind === 'gravity' ? anim.targetSet : anim?.kind === 'match' ? anim.hideSet : null;
  for (let r = VISIBLE_START; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (animTargets && animTargets.has(cellKey(r, c))) continue;
      const cell = game.board[r][c];
      if (cell !== CELL_EMPTY) drawCell(r, c, cell);
    }
  }
  drawResolveAnimations();
  drawHandAndLauncher();
  drawTextOverlay();
}

function stepGame(dt) {
  if (game.timers.actionCooldown > 0) game.timers.actionCooldown -= dt;
  game.fx.phase += dt / 1000;
  game.fx.pulse = Math.max(0, game.fx.pulse - dt / 260);
  for (let i = game.fx.banners.length - 1; i >= 0; i--) {
    const b = game.fx.banners[i];
    b.life -= dt;
    if (b.life <= 0) game.fx.banners.splice(i, 1);
  }
  for (let i = game.fx.scorePopups.length - 1; i >= 0; i--) {
    const sp = game.fx.scorePopups[i];
    sp.life -= dt;
    sp.y += (sp.vy * dt) / 1000;
    if (sp.life <= 0) game.fx.scorePopups.splice(i, 1);
  }

  if (game.paused || game.gameOver || isSettingsOpen()) return;
  if (game.resolving) {
    if (!game.resolve) {
      game.resolving = false;
      return;
    }
    if (game.resolve.anim) {
      const anim = game.resolve.anim;
      anim.elapsed += dt;
      if (anim.kind === 'match') {
        const decay = dt / anim.duration;
        for (const p of anim.particles) {
          p.x += (p.vx * dt) / 1000;
          p.y += (p.vy * dt) / 1000;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.life -= decay;
        }
      }
      if (anim.elapsed >= anim.duration) {
        game.resolve.anim = null;
        game.resolve.delay = 0;
      }
      return;
    }
    game.resolve.delay -= dt;
    if (game.resolve.delay <= 0) {
      processResolveStep();
      if (game.resolve) game.resolve.delay = RESOLVE_STEP_MS;
    }
    return;
  }

  const mult = DIFF_PROGRESS_MULT[settings.difficulty];
  game.levelProgress += (dt / 1000) * TIME_RATE * mult;
  maybeLevelUp();

  game.timers.descentElapsed += dt;
  let interval = descentIntervalMs(game.level, settings.difficulty);
  while (game.timers.descentElapsed >= interval) {
    game.timers.descentElapsed -= interval;
    descentStep();
    if (game.gameOver) break;
    interval = descentIntervalMs(game.level, settings.difficulty);
  }

  game.timers.dangerCooldown -= dt;
  const lowest = lowestOccupiedRow();
  if (lowest >= ROWS - 2 && game.timers.dangerCooldown <= 0) {
    playSfx('danger');
    game.timers.dangerCooldown = 1000;
    game.status = 'Danger!';
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
    updateHud();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function handleKeyDown(ev) {
  const key = ev.key.toLowerCase();
  if (isSettingsOpen()) {
    if (key === 'escape') {
      closeSettings();
      ev.preventDefault();
    }
    return;
  }
  if (key === 'arrowleft' || key === 'a') {
    game.hand.col = Math.max(0, game.hand.col - 1);
    playSfx('move');
    ev.preventDefault();
  } else if (key === 'arrowright' || key === 'd') {
    game.hand.col = Math.min(COLS - 1, game.hand.col + 1);
    playSfx('move');
    ev.preventDefault();
  } else if (key === ' ' || key === 'z' || key === 'enter') {
    doAction();
    ev.preventDefault();
  } else if (key === 'p') {
    togglePause();
    ev.preventDefault();
  } else if (key === 'r') {
    newGame();
    ev.preventDefault();
  } else if (key === 'm') {
    settings.audioEnabled = !settings.audioEnabled;
    saveSettings(settings);
    sfx.setEnabled(settings.audioEnabled);
    syncSettingsUI(settings);
    ev.preventDefault();
  }
}

canvas.addEventListener('mousemove', (ev) => setColumnFromClientX(ev.clientX));
canvas.addEventListener('pointerdown', (ev) => {
  unlockAudio();
  setColumnFromClientX(ev.clientX);
  doAction();
});
canvas.addEventListener(
  'touchstart',
  (ev) => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    if (!t) return;
    unlockAudio();
    setColumnFromClientX(t.clientX);
    doAction();
  },
  { passive: false }
);
canvas.addEventListener(
  'touchmove',
  (ev) => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    if (!t) return;
    setColumnFromClientX(t.clientX);
  },
  { passive: false }
);

document.addEventListener('keydown', handleKeyDown, { passive: false });
document.addEventListener('pointerdown', unlockAudio, { once: true });
newBtn.addEventListener('click', () => newGame());
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

setupView();
syncSettingsUI(settings);
sfx.setEnabled(settings.audioEnabled);
initGameShell({
  shellEl: '.cascade-wrap',
  surfaceEl: '#cascade-surface',
  canvasEl: canvas,
  baseWidth: canvas.width,
  baseHeight: canvas.height,
  mode: 'fractional',
  fit: 'css',
  onResize: setupView,
});
newGame();
loop();
