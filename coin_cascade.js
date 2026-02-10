import { SfxEngine } from './sfx_engine.js';
import { BANK_COIN_CASCADE } from './sfx_bank_coin_cascade.js';
import { initGameShell } from './game-shell.js';

const COLS = 6;
const ROWS_VISIBLE = 12;
const ROWS_BUFFER = 6;
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
const ROMAN = ['I', 'V', 'X', 'L', 'C', 'D'];
const BASE_DESCENT_MS = { 1: 1600, 2: 1450, 3: 1325, 4: 1200, 5: 1100, 6: 1000, 7: 925, 8: 850 };
const DIFF_LEVEL_SHIFT = { 1: -6, 2: -4, 3: -2, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8 };
const DIFF_PROGRESS_MULT = { 1: 0.85, 2: 0.9, 3: 0.95, 4: 1, 5: 1.05, 6: 1.1, 7: 1.15, 8: 1.2 };

const LEVEL_UP_THRESHOLD = 30;
const TIME_RATE = 1;
const CLEAR_RATE = 0.1;
const SPECIAL_RATE = 2;
const FIXED_DT = 1000 / 60;

const STORAGE = {
  difficulty: 'coin_cascade.difficulty',
  audioEnabled: 'coin_cascade.audioEnabled',
};

const DEFAULT_SETTINGS = {
  difficulty: 4,
  audioEnabled: true,
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
    },
  };
}

function sanitizeSettings(next) {
  return {
    difficulty: clamp(Math.round(toNumber(next.difficulty, DEFAULT_SETTINGS.difficulty)), 1, 8),
    audioEnabled: next.audioEnabled !== false,
  };
}

function loadSettings() {
  const difficulty = toNumber(localStorage.getItem(STORAGE.difficulty), DEFAULT_SETTINGS.difficulty);
  const audioEnabled = localStorage.getItem(STORAGE.audioEnabled) !== 'false';
  return sanitizeSettings({ difficulty, audioEnabled });
}

function saveSettings(next) {
  localStorage.setItem(STORAGE.difficulty, String(next.difficulty));
  localStorage.setItem(STORAGE.audioEnabled, next.audioEnabled ? 'true' : 'false');
}

function syncSettingsUI(next) {
  if (difficultyInput) difficultyInput.value = String(next.difficulty);
  if (audioEnabledSelect) audioEnabledSelect.value = next.audioEnabled ? 'on' : 'off';
}

function applySettingsFromUI() {
  const next = sanitizeSettings({
    difficulty: difficultyInput.value,
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
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = game.board[r][c];
      if (cell !== CELL_EMPTY) {
        if (write !== r) {
          game.board[write][c] = cell;
          game.board[r][c] = CELL_EMPTY;
        }
        write--;
      }
    }
  }
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

function activateSpecialsOnce() {
  let changed = false;
  let scoreDelta = 0;
  let cleared = 0;
  let specialActivations = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = game.board[r][c];
      if (cell !== CELL_PLUS && cell !== CELL_MINUS) continue;

      let rr = r + 1;
      while (rr < ROWS && game.board[rr][c] === CELL_EMPTY) rr++;

      if (rr < ROWS && isCoin(game.board[rr][c])) {
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

function applyScoreForStep(conversions, chainStep) {
  const chainMult = 1 + 0.5 * (chainStep - 1);
  const comboMult = 1 + 0.25 * (conversions.length - 1);
  let stepPoints = 0;
  let anyDClear = false;

  for (const conv of conversions) {
    stepPoints += DENOM[conv.tier] * conv.size * 10;
    if (conv.tier === 5) anyDClear = true;
  }

  stepPoints = Math.floor(stepPoints * chainMult * comboMult);
  if (anyDClear) stepPoints += 1000;
  game.score += stepPoints;
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

function resolveBoard() {
  game.resolving = true;
  let chain = 0;
  let guard = 0;
  let clearedInResolve = 0;
  let specialsInResolve = 0;

  while (guard++ < 64) {
    applyGravity();
    const specialResult = activateSpecialsOnce();
    if (specialResult.scoreDelta > 0) game.score += specialResult.scoreDelta;
    clearedInResolve += specialResult.cleared;
    specialsInResolve += specialResult.specialActivations;

    const groups = findGroups();
    const toConvert = groups.filter((g) => g.cells.length >= REQUIRE[g.tier]);
    if (toConvert.length === 0 && !specialResult.changed) break;

    if (toConvert.length === 0) continue;
    chain++;

    const clearMask = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const spawns = [];
    const conversions = [];

    for (const group of toConvert) {
      for (const [r, c] of group.cells) clearMask[r][c] = true;
      const spawnAt = selectUpgradeSpawn(group.cells);
      if (group.tier < 5) spawns.push({ r: spawnAt[0], c: spawnAt[1], cell: cellOfTier(group.tier + 1) });
      conversions.push({ tier: group.tier, size: group.cells.length });
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
    clearedInResolve += removedCount;
    game.coinsCleared += removedCount;

    for (const spawn of spawns) {
      game.board[spawn.r][spawn.c] = spawn.cell;
    }

    applyScoreForStep(conversions, chain);
    playSfx(chain >= 2 || conversions.length >= 2 ? 'convertBig' : 'convertSmall');
    playSfx('chainStep', { chain, groups: conversions.length });
    game.maxChain = Math.max(game.maxChain, chain);
    game.chainsTotal += 1;
  }

  game.lastChain = chain;
  if (chain > 0) game.status = `Chain ${chain}!`;
  updateProgressFromClear(clearedInResolve, specialsInResolve);
  maybeLevelUp();
  game.resolving = false;
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
  resolveBoard();
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
  const height = countOccupied(col);
  const startRow = ROWS - 1 - height;
  if (startRow - (game.hand.stack.length - 1) < 0) {
    gameOver();
    return false;
  }

  for (let i = 0; i < game.hand.stack.length; i++) {
    const r = startRow - i;
    game.board[r][col] = game.hand.stack[i];
  }
  game.hand.stack.length = 0;
  game.status = 'Thrown';
  playSfx('throw');
  playSfx('land');
  resolveBoard();
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

function highestOccupiedRow() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (game.board[r][c] !== CELL_EMPTY) return r;
  }
  return ROWS;
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
  for (let i = 0; i < 4; i++) {
    const row = generateSpawnRow(1, settings.difficulty);
    for (let c = 0; c < COLS; c++) {
      game.board[ROWS - 1 - i][c] = row[c];
    }
  }
  resolveBoard();
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
  game.status = 'Ready.';
  game.statusBeforePause = 'Ready.';
  game.timers.descentElapsed = 0;
  game.timers.actionCooldown = 0;
  game.timers.dangerCooldown = 0;
  game.fx.phase = 0;
  game.fx.pulse = 0;
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
  const numeral = ROMAN[tier];
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
    const startRow = ROWS - 1 - height;
    if (startRow - (game.hand.stack.length - 1) >= 0) {
      for (let i = 0; i < game.hand.stack.length; i++) {
        const r = startRow - i;
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
}

function draw() {
  drawBackground();
  drawField();
  drawColumnHighlight();
  for (let r = VISIBLE_START; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = game.board[r][c];
      if (cell !== CELL_EMPTY) drawCell(r, c, cell);
    }
  }
  drawHandAndLauncher();
  drawTextOverlay();
}

function stepGame(dt) {
  if (game.timers.actionCooldown > 0) game.timers.actionCooldown -= dt;
  game.fx.phase += dt / 1000;
  game.fx.pulse = Math.max(0, game.fx.pulse - dt / 260);

  if (game.paused || game.gameOver || isSettingsOpen()) return;

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
  const highest = highestOccupiedRow();
  if (highest <= VISIBLE_START + 1 && game.timers.dangerCooldown <= 0) {
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
