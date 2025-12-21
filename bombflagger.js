const Preset = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  EXPERT: 'expert',
  CUSTOM: 'custom',
};

const PRESETS = {
  [Preset.BEGINNER]: { rows: 8, cols: 8, mines: 10 },
  [Preset.INTERMEDIATE]: { rows: 16, cols: 16, mines: 40 },
  [Preset.EXPERT]: { rows: 16, cols: 30, mines: 99 },
};

const LIMITS = {
  minRows: 8,
  maxRows: 24,
  minCols: 8,
  maxCols: 30,
  minMines: 10,
};

const STORAGE = {
  preset: 'ms.preset',
  customRows: 'ms.custom.rows',
  customCols: 'ms.custom.cols',
  customMines: 'ms.custom.mines',
  firstSafe: 'ms.opt.firstSafe',
  questionMarks: 'ms.opt.questionMarks',
};

const Mark = {
  NONE: 0,
  FLAG: 1,
  QUESTION: 2,
};

const Face = {
  NORMAL: '🙂',
  PRESSED: '😮',
  DEAD: '😵',
  WIN: '😎',
};

const Emoji = {
  FLAG: '🚩',
  MINE: '💣',
  BOOM: '💥',
  WRONG: '❌',
};

const NUMBER_COLORS = {
  1: '#2563eb',
  2: '#16a34a',
  3: '#dc2626',
  4: '#1e3a8a',
  5: '#991b1b',
  6: '#0f766e',
  7: '#111827',
  8: '#6b7280',
};

const canvas = document.getElementById('bomb-canvas');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const faceBtn = document.getElementById('face-button');
const mineCountEl = document.getElementById('mine-count');
const timeCountEl = document.getElementById('time-count');

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const presetSelect = document.getElementById('preset-select');
const rowsInput = document.getElementById('rows-input');
const colsInput = document.getElementById('cols-input');
const minesInput = document.getElementById('mines-input');
const maxMinesEl = document.getElementById('max-mines');
const firstSafeToggle = document.getElementById('first-safe-toggle');
const questionToggle = document.getElementById('question-toggle');
const settingsError = document.getElementById('settings-error');

let settings = loadSettings();
let tileSize = 24;
let game = null;

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function maxMinesClassic(rows, cols) {
  return (rows - 1) * (cols - 1);
}

function formatCounter(value) {
  const sign = value < 0 ? '-' : '';
  const num = Math.min(999, Math.abs(value));
  return `${sign}${String(num).padStart(3, '0')}`;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function loadSettings() {
  const presetStored = localStorage.getItem(STORAGE.preset);
  const preset = Object.values(Preset).includes(presetStored) ? presetStored : Preset.BEGINNER;

  const customRows = Number(localStorage.getItem(STORAGE.customRows)) || PRESETS[Preset.INTERMEDIATE].rows;
  const customCols = Number(localStorage.getItem(STORAGE.customCols)) || PRESETS[Preset.INTERMEDIATE].cols;
  const customMines = Number(localStorage.getItem(STORAGE.customMines)) || PRESETS[Preset.INTERMEDIATE].mines;
  const custom = sanitizeCustom(customRows, customCols, customMines).value;

  const firstSafe = localStorage.getItem(STORAGE.firstSafe) !== 'false';
  const questionMarks = localStorage.getItem(STORAGE.questionMarks) !== 'false';

  if (preset === Preset.CUSTOM) {
    return { preset, rows: custom.rows, cols: custom.cols, mines: custom.mines, custom, firstSafe, questionMarks };
  }

  const presetVals = PRESETS[preset] || PRESETS[Preset.BEGINNER];
  return { preset, rows: presetVals.rows, cols: presetVals.cols, mines: presetVals.mines, custom, firstSafe, questionMarks };
}

function saveSettings(next) {
  localStorage.setItem(STORAGE.preset, next.preset);
  localStorage.setItem(STORAGE.customRows, String(next.custom.rows));
  localStorage.setItem(STORAGE.customCols, String(next.custom.cols));
  localStorage.setItem(STORAGE.customMines, String(next.custom.mines));
  localStorage.setItem(STORAGE.firstSafe, String(next.firstSafe));
  localStorage.setItem(STORAGE.questionMarks, String(next.questionMarks));
}

function sanitizeCustom(rows, cols, mines) {
  const safeRows = clamp(Math.round(rows || LIMITS.minRows), LIMITS.minRows, LIMITS.maxRows);
  const safeCols = clamp(Math.round(cols || LIMITS.minCols), LIMITS.minCols, LIMITS.maxCols);
  const maxMines = maxMinesClassic(safeRows, safeCols);
  const safeMines = clamp(Math.round(mines || LIMITS.minMines), LIMITS.minMines, maxMines);
  if (safeMines >= safeRows * safeCols) {
    return { error: 'Mines must leave at least one safe tile.' };
  }
  return { value: { rows: safeRows, cols: safeCols, mines: safeMines, maxMines } };
}

function syncSettingsUI(presetOverride) {
  const preset = presetOverride || settings.preset;
  presetSelect.value = preset;
  const useCustom = preset === Preset.CUSTOM;
  const presetVals = PRESETS[preset] || PRESETS[Preset.BEGINNER];
  const rows = useCustom ? settings.custom.rows : presetVals.rows;
  const cols = useCustom ? settings.custom.cols : presetVals.cols;
  const mines = useCustom ? settings.custom.mines : presetVals.mines;
  rowsInput.value = rows;
  colsInput.value = cols;
  minesInput.value = mines;
  firstSafeToggle.checked = settings.firstSafe;
  questionToggle.checked = settings.questionMarks;

  const customResult = sanitizeCustom(Number(rowsInput.value), Number(colsInput.value), Number(minesInput.value));
  const maxMines = customResult.value ? customResult.value.maxMines : maxMinesClassic(rows, cols);
  minesInput.max = String(maxMines);
  maxMinesEl.textContent = `Max mines: ${maxMines}`;

  const disabled = preset !== Preset.CUSTOM;
  rowsInput.disabled = disabled;
  colsInput.disabled = disabled;
  minesInput.disabled = disabled;
  settingsError.textContent = '';
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setFace(face) {
  faceBtn.textContent = face;
}

function openSettings() {
  settingsError.textContent = '';
  syncSettingsUI();
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
  settingsError.textContent = '';
}

function updateCustomMeta() {
  const customResult = sanitizeCustom(Number(rowsInput.value), Number(colsInput.value), Number(minesInput.value));
  if (!customResult.value) {
    settingsError.textContent = customResult.error || 'Invalid custom values.';
    return;
  }
  settingsError.textContent = '';
  minesInput.max = String(customResult.value.maxMines);
  maxMinesEl.textContent = `Max mines: ${customResult.value.maxMines}`;
}

function applySettingsFromUI() {
  const preset = presetSelect.value;
  const firstSafe = firstSafeToggle.checked;
  const questionMarks = questionToggle.checked;

  let custom = settings.custom;
  let rows = settings.rows;
  let cols = settings.cols;
  let mines = settings.mines;

  if (preset === Preset.CUSTOM) {
    const result = sanitizeCustom(Number(rowsInput.value), Number(colsInput.value), Number(minesInput.value));
    if (!result.value) {
      settingsError.textContent = result.error || 'Invalid custom values.';
      return false;
    }
    custom = { rows: result.value.rows, cols: result.value.cols, mines: result.value.mines };
    rows = custom.rows;
    cols = custom.cols;
    mines = custom.mines;
  } else {
    const presetVals = PRESETS[preset];
    rows = presetVals.rows;
    cols = presetVals.cols;
    mines = presetVals.mines;
  }

  settings = { preset, rows, cols, mines, custom, firstSafe, questionMarks };
  saveSettings(settings);
  return true;
}

function makeGameState() {
  const size = settings.rows * settings.cols;
  return {
    rows: settings.rows,
    cols: settings.cols,
    mines: settings.mines,
    firstSafe: settings.firstSafe,
    questionMarks: settings.questionMarks,
    mineMap: Array(size).fill(false),
    revealed: Array(size).fill(false),
    marks: Array(size).fill(Mark.NONE),
    adjacent: Array(size).fill(0),
    minesPlaced: !settings.firstSafe,
    revealedCount: 0,
    flags: 0,
    exploded: -1,
    gameOver: false,
    won: false,
    timerId: null,
    elapsed: 0,
  };
}

function indexOf(r, c) {
  return r * game.cols + c;
}

function coordsOf(i) {
  return { r: Math.floor(i / game.cols), c: i % game.cols };
}

function forEachNeighbor(i, fn) {
  const { r, c } = coordsOf(i);
  for (let rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= game.rows) continue;
    for (let cc = c - 1; cc <= c + 1; cc++) {
      if (cc < 0 || cc >= game.cols) continue;
      if (rr === r && cc === c) continue;
      fn(indexOf(rr, cc));
    }
  }
}

function placeMines(excludeIndex) {
  const total = game.rows * game.cols;
  const pool = [];
  for (let i = 0; i < total; i++) {
    if (excludeIndex >= 0 && i === excludeIndex) continue;
    pool.push(i);
  }
  shuffle(pool);
  for (let m = 0; m < game.mines; m++) {
    game.mineMap[pool[m]] = true;
  }
  computeAdjacency();
}

function computeAdjacency() {
  const total = game.rows * game.cols;
  for (let i = 0; i < total; i++) {
    if (game.mineMap[i]) {
      game.adjacent[i] = 0;
      continue;
    }
    let count = 0;
    forEachNeighbor(i, (n) => {
      if (game.mineMap[n]) count += 1;
    });
    game.adjacent[i] = count;
  }
}

function startTimer() {
  if (game.timerId) return;
  game.timerId = window.setInterval(() => {
    if (game.gameOver) return;
    game.elapsed = Math.min(999, game.elapsed + 1);
    updateCounters();
  }, 1000);
}

function stopTimer() {
  if (game.timerId) {
    clearInterval(game.timerId);
    game.timerId = null;
  }
}

function resetTimer() {
  stopTimer();
  game.elapsed = 0;
  updateCounters();
}

function updateCounters() {
  mineCountEl.textContent = formatCounter(game.mines - game.flags);
  timeCountEl.textContent = formatCounter(game.elapsed);
}

function revealCell(i) {
  if (game.revealed[i] || game.marks[i] === Mark.FLAG) return;
  if (!game.minesPlaced) {
    placeMines(i);
    game.minesPlaced = true;
  }
  if (!game.timerId) startTimer();

  game.revealed[i] = true;
  game.revealedCount += 1;

  if (game.mineMap[i]) {
    game.exploded = i;
    onLose();
    return;
  }

  if (game.adjacent[i] === 0) {
    floodReveal(i);
  }

  if (checkWin()) {
    onWin();
  }
}

function floodReveal(start) {
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop();
    forEachNeighbor(i, (n) => {
      if (game.revealed[n] || game.marks[n] === Mark.FLAG) return;
      if (game.mineMap[n]) return;
      game.revealed[n] = true;
      game.revealedCount += 1;
      if (game.adjacent[n] === 0) {
        stack.push(n);
      }
    });
  }
}

function checkWin() {
  const totalSafe = game.rows * game.cols - game.mines;
  return game.revealedCount >= totalSafe;
}

function onLose() {
  game.gameOver = true;
  game.won = false;
  setFace(Face.DEAD);
  stopTimer();
  setStatus('Boom! You hit a mine.');
  drawBoard();
}

function onWin() {
  game.gameOver = true;
  game.won = true;
  setFace(Face.WIN);
  stopTimer();
  for (let i = 0; i < game.mineMap.length; i++) {
    if (game.mineMap[i] && game.marks[i] !== Mark.FLAG) {
      game.marks[i] = Mark.FLAG;
      game.flags += 1;
    }
    if (!game.mineMap[i]) {
      game.revealed[i] = true;
    }
  }
  updateCounters();
  setStatus('You cleared the field!');
  drawBoard();
}

function toggleMark(i) {
  if (game.revealed[i] || game.gameOver) return;
  const current = game.marks[i];
  let next = Mark.NONE;
  if (game.questionMarks) {
    next = (current + 1) % 3;
  } else {
    next = current === Mark.FLAG ? Mark.NONE : Mark.FLAG;
  }

  if (current === Mark.FLAG) game.flags -= 1;
  if (next === Mark.FLAG) game.flags += 1;

  game.marks[i] = next;
  updateCounters();
  drawBoard();
}

function newGame() {
  game = makeGameState();
  resetTimer();
  game.exploded = -1;
  setFace(Face.NORMAL);
  setStatus('Ready.');
  updateCounters();
  if (!game.firstSafe) {
    placeMines(-1);
    game.minesPlaced = true;
  }
  resizeCanvas();
  drawBoard();
}

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const available = wrap ? wrap.clientWidth - 4 : 640;
  const maxTile = 30;
  const minTile = 16;
  tileSize = clamp(Math.floor(available / game.cols), minTile, maxTile);

  const width = game.cols * tileSize;
  const height = game.rows * tileSize;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBevel(x, y, size, raised) {
  const light = '#f8fafc';
  const dark = '#7b7f86';
  ctx.strokeStyle = raised ? light : dark;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + size - 0.5);
  ctx.lineTo(x + 0.5, y + 0.5);
  ctx.lineTo(x + size - 0.5, y + 0.5);
  ctx.stroke();

  ctx.strokeStyle = raised ? dark : light;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + size - 0.5);
  ctx.lineTo(x + size - 0.5, y + size - 0.5);
  ctx.lineTo(x + size - 0.5, y + 0.5);
  ctx.stroke();
}

function drawBoard() {
  ctx.clearRect(0, 0, game.cols * tileSize, game.rows * tileSize);
  const total = game.rows * game.cols;
  const emojiSize = Math.floor(tileSize * 0.65);
  const numberSize = Math.floor(tileSize * 0.6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < total; i++) {
    const { r, c } = coordsOf(i);
    const x = c * tileSize;
    const y = r * tileSize;
    const revealed = game.revealed[i];
    const hasMine = game.mineMap[i];
    const isExploded = game.exploded === i;
    const flagged = game.marks[i] === Mark.FLAG;
    const showMine = (revealed && hasMine) || (game.gameOver && hasMine && !flagged);
    const showRevealed = revealed || showMine;

    if (showRevealed) {
      ctx.fillStyle = isExploded ? '#fca5a5' : '#d1d5db';
      ctx.fillRect(x, y, tileSize, tileSize);
      drawBevel(x, y, tileSize, false);
    } else {
      ctx.fillStyle = '#bfc3c7';
      ctx.fillRect(x, y, tileSize, tileSize);
      drawBevel(x, y, tileSize, true);
    }

    if (showMine) {
      ctx.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui`;
      ctx.fillText(isExploded ? Emoji.BOOM : Emoji.MINE, x + tileSize / 2, y + tileSize / 2);
    } else if (revealed) {
      if (game.adjacent[i] > 0) {
        const value = game.adjacent[i];
        ctx.font = `${numberSize}px "Trebuchet MS", sans-serif`;
        ctx.fillStyle = NUMBER_COLORS[value] || '#111827';
        ctx.fillText(String(value), x + tileSize / 2, y + tileSize / 2);
      }
    } else if (game.marks[i] === Mark.FLAG) {
        ctx.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui`;
      ctx.fillText(Emoji.FLAG, x + tileSize / 2, y + tileSize / 2);
    } else if (game.marks[i] === Mark.QUESTION) {
      ctx.font = `${numberSize}px "Trebuchet MS", sans-serif`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2);
    }

    if (game.gameOver && !hasMine && game.marks[i] === Mark.FLAG) {
      ctx.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui`;
      ctx.fillText(Emoji.WRONG, x + tileSize / 2, y + tileSize / 2);
    }
  }
}

function getCellFromEvent(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if (x < 0 || y < 0) return null;
  const c = Math.floor(x / tileSize);
  const r = Math.floor(y / tileSize);
  if (c < 0 || c >= game.cols || r < 0 || r >= game.rows) return null;
  return indexOf(r, c);
}

function handleLeftClick(ev) {
  if (game.gameOver) return;
  const index = getCellFromEvent(ev);
  if (index === null) return;
  revealCell(index);
  drawBoard();
}

function handleRightClick(ev) {
  ev.preventDefault();
  if (game.gameOver) return;
  const index = getCellFromEvent(ev);
  if (index === null) return;
  toggleMark(index);
}

function attachEvents() {
  faceBtn.addEventListener('click', () => {
    newGame();
  });

  canvas.addEventListener('click', (ev) => {
    if (ev.button !== 0) return;
    handleLeftClick(ev);
  });

  canvas.addEventListener('contextmenu', handleRightClick);

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || game.gameOver) return;
    setFace(Face.PRESSED);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (ev.button !== 0 || game.gameOver) return;
    setFace(game.won ? Face.WIN : Face.NORMAL);
  });

  canvas.addEventListener('pointerleave', () => {
    if (game.gameOver) return;
    setFace(Face.NORMAL);
  });

  settingsToggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openSettings();
  });

  settingsClose.addEventListener('click', closeSettings);
  settingsCancel.addEventListener('click', closeSettings);

  settingsModal.addEventListener('click', (ev) => {
    if (ev.target === settingsModal) closeSettings();
  });

  presetSelect.addEventListener('change', () => {
    syncSettingsUI(presetSelect.value);
  });

  rowsInput.addEventListener('input', updateCustomMeta);
  colsInput.addEventListener('input', updateCustomMeta);
  minesInput.addEventListener('input', updateCustomMeta);

  settingsApply.addEventListener('click', () => {
    if (!applySettingsFromUI()) return;
    closeSettings();
    newGame();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      closeSettings();
    }
  });

  window.addEventListener('resize', () => {
    if (!game) return;
    resizeCanvas();
    drawBoard();
  });
}

attachEvents();
newGame();
