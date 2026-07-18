import { PEERS, bit, idx, row, col, generatePuzzle } from './sudoku_engine.js';

const DIFFS = ['easy', 'medium', 'hard', 'extreme'];
const DIFF_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

const appState = {
  screen: 'title',
  diff: null,
};

let gameState = null;

const screenTitle = document.getElementById('screen-title');
const screenGame = document.getElementById('screen-game');
const modalEl = document.getElementById('modal');
const modalTextEl = document.getElementById('modal-text');
const modalYesBtn = document.getElementById('modal-yes');
const modalNoBtn = document.getElementById('modal-no');

const boardEl = document.getElementById('board');
const keypadEl = document.getElementById('keypad');
const diffLabelEl = document.getElementById('diff-label');
const modeLabelEl = document.getElementById('mode-label');
const statusEl = document.getElementById('status');
const quitBtn = document.getElementById('btn-quit');
const instructionsBtn = document.getElementById('btn-instructions');
const settingsToggle = document.getElementById('settings-toggle');
const settingsMenu = document.getElementById('settings-menu');
const settingsThemeBtn = document.getElementById('settings-theme');
const winModal = document.getElementById('win-modal');
const winClose = document.getElementById('win-close');
const winNew = document.getElementById('win-new');
const winReplay = document.getElementById('win-replay');
const winMessage = document.getElementById('win-message');
const winTime = document.getElementById('win-time');
const winDiff = document.getElementById('win-diff');
const instructionsModal = document.getElementById('instructions-modal');
const instructionsCloseBtn = document.getElementById('instructions-close');

const THEME_KEY = 'sudoku_theme';

const cellEls = [];
const valueEls = [];
const notesEls = [];
const noteSpanEls = [];
const keyEls = [];
const undoStack = [];
const UNDO_LIMIT = 200;
const SAVE_THROTTLE_MS = 250;
let saveTimer = null;
let hintFlashTimer = null;

function hasNote(mask, d) {
  return (mask & bit(d)) !== 0;
}

function toggleNote(mask, d) {
  return mask ^ bit(d);
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function showScreen(name) {
  appState.screen = name;
  screenTitle.classList.toggle('hidden', name !== 'title');
  screenGame.classList.toggle('hidden', name !== 'game');
}

function setStatus(text) {
  if (!statusEl) return;
  statusEl.textContent = text;
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (v) => String(v).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function getElapsedMs() {
  if (!gameState || !gameState.startedAt) return 0;
  return Date.now() - gameState.startedAt;
}

function showWinModal() {
  if (!winModal || !gameState) return;
  if (winMessage) {
    winMessage.textContent = `You solved a ${DIFF_LABELS[gameState.diff] || gameState.diff} puzzle!`;
  }
  if (winTime) {
    winTime.textContent = formatTime(getElapsedMs());
  }
  if (winDiff) {
    winDiff.textContent = DIFF_LABELS[gameState.diff] || gameState.diff || '-';
  }
  winModal.classList.remove('hidden');
}

function closeWinModal() {
  if (!winModal) return;
  winModal.classList.add('hidden');
}

function updateThemeMenuLabel() {
  if (!settingsThemeBtn) return;
  const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
  settingsThemeBtn.textContent = current === 'dark' ? 'Light Theme' : 'Dark Theme';
}

function setTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  updateThemeMenuLabel();
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {
      // ignore theme save errors
    }
  }
}

function initTheme() {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch (err) {
    // ignore
  }
  setTheme(theme, false);
}

function updateLabels() {
  if (!gameState) return;
  diffLabelEl.textContent = DIFF_LABELS[gameState.diff] || gameState.diff;
  const mode = gameState.input.mode;
  modeLabelEl.textContent = mode === 'pencil' ? 'Pencil' : (mode === 'eraser' ? 'Eraser' : 'Pen');
}

function buildBoard() {
  boardEl.innerHTML = '';
  cellEls.length = 0;
  valueEls.length = 0;
  notesEls.length = 0;
  noteSpanEls.length = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const i = idx(r, c);
      const cell = document.createElement('div');
      cell.className = `cell r${r} c${c}`;
      cell.dataset.i = String(i);

      const valueEl = document.createElement('div');
      valueEl.className = 'value';

      const notesEl = document.createElement('div');
      notesEl.className = 'notes';
      const spans = Array(10);
      for (let d = 1; d <= 9; d++) {
        const span = document.createElement('span');
        span.dataset.note = String(d);
        notesEl.appendChild(span);
        spans[d] = span;
      }

      cell.appendChild(valueEl);
      cell.appendChild(notesEl);
      boardEl.appendChild(cell);
      cellEls[i] = cell;
      valueEls[i] = valueEl;
      notesEls[i] = notesEl;
      noteSpanEls[i] = spans;
    }
  }
  boardEl.addEventListener('click', onBoardClick);
  boardEl.addEventListener('auxclick', onBoardAuxClick);
}

function buildKeypad() {
  keypadEl.innerHTML = '';
  keyEls.length = 0;
  const keys = [
    1, 2, 3, 4, 5, 6, 7, 8, 9,
    { tool: 'pencil', label: '✏️' },
    { tool: 'eraser', label: '🧽' },
    { tool: 'undo', label: '↩️' },
  ];

  for (const k of keys) {
    const el = document.createElement('div');
    el.className = 'key';
    if (typeof k === 'number') {
      el.dataset.digit = String(k);
      el.textContent = String(k);
      const countEl = document.createElement('span');
      countEl.className = 'count';
      el.appendChild(countEl);
    } else {
      el.dataset.tool = k.tool;
      el.classList.add('tool');
      el.textContent = k.label;
      if (k.tool === 'pencil') {
        el.title = 'Pencil (notes)';
        el.setAttribute('aria-label', 'Pencil (notes)');
      } else if (k.tool === 'eraser') {
        el.title = 'Eraser (clear cell)';
        el.setAttribute('aria-label', 'Eraser (clear cell)');
      } else if (k.tool === 'undo') {
        el.title = 'Undo';
        el.setAttribute('aria-label', 'Undo');
      }
    }
    keypadEl.appendChild(el);
    keyEls.push(el);
  }
  keypadEl.addEventListener('click', onKeypadClick);
}

function renderKeypad() {
  if (!gameState) return;
  const mode = gameState.input.mode;
  const activeDigit = gameState.input.digit;
  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = gameState.board[i];
    if (v) counts[v]++;
  }
  for (const key of keyEls) {
    key.classList.remove('active');
    const digit = key.dataset.digit ? Number(key.dataset.digit) : null;
    if (digit) {
      if (digit === activeDigit && mode !== 'eraser') key.classList.add('active');
      const countEl = key.querySelector('.count');
      if (countEl) countEl.textContent = counts[digit];
    }
    const tool = key.dataset.tool;
    if (tool === 'pencil' && mode === 'pencil') key.classList.add('active');
    if (tool === 'eraser' && mode === 'eraser') key.classList.add('active');
  }
}

function renderBoard() {
  if (!gameState) return;
  const activeDigit = gameState.input.mode !== 'eraser' ? gameState.input.digit : null;
  for (let i = 0; i < 81; i++) {
    const cell = cellEls[i];
    const value = gameState.board[i];
    const fixed = gameState.fixed[i];

    cell.classList.toggle('fixed', fixed);
    cell.classList.toggle('revealed', gameState.revealed[i]);
    cell.classList.toggle('error', gameState.errors[i]);
    cell.classList.toggle('selected', gameState.selection && gameState.selection.i === i);
    cell.classList.toggle('highlight-digit', activeDigit && (value === activeDigit || hasNote(gameState.notes[i], activeDigit)));

    const valueEl = valueEls[i];
    const notesEl = notesEls[i];
    const noteSpans = noteSpanEls[i];

    if (value !== 0) {
      valueEl.textContent = String(value);
      notesEl.style.visibility = 'hidden';
    } else {
      valueEl.textContent = '';
      notesEl.style.visibility = 'visible';
      const mask = gameState.notes[i];
      for (let d = 1; d <= 9; d++) {
        const span = noteSpans[d];
        span.textContent = hasNote(mask, d) ? String(d) : '';
      }
    }
  }
}

function flashInvalid(i) {
  const cell = cellEls[i];
  cell.classList.add('invalid');
  setTimeout(() => cell.classList.remove('invalid'), 350);
}

function flashHint(i) {
  for (const cell of cellEls) cell.classList.remove('hint-flash');
  if (hintFlashTimer !== null) {
    clearTimeout(hintFlashTimer);
    hintFlashTimer = null;
  }

  const cell = cellEls[i];
  if (!cell) return;

  // Restart the animation even when the same cell is hinted twice after undo.
  void cell.offsetWidth;
  cell.classList.add('hint-flash');
  hintFlashTimer = window.setTimeout(() => {
    cell.classList.remove('hint-flash');
    hintFlashTimer = null;
  }, 1900);
}

function isValidPlacement(board, i, d) {
  const r = row(i);
  const c = col(i);
  for (let cc = 0; cc < 9; cc++) {
    const j = idx(r, cc);
    if (j !== i && board[j] === d) return false;
  }
  for (let rr = 0; rr < 9; rr++) {
    const j = idx(rr, c);
    if (j !== i && board[j] === d) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      const j = idx(rr, cc);
      if (j !== i && board[j] === d) return false;
    }
  }
  return true;
}

function applyInputToCell(i, d, modeOverride) {
  if (!gameState || gameState.completed) return;
  if (gameState.fixed[i]) return;

  const mode = modeOverride || gameState.input.mode;
  if (mode === 'eraser') {
    const shouldClear = gameState.board[i] !== 0 || gameState.notes[i] !== 0 || gameState.revealed[i] || gameState.errors[i];
    if (!shouldClear) return;
    pushUndo();
    gameState.board[i] = 0;
    gameState.notes[i] = 0;
    gameState.revealed[i] = false;
    gameState.errors[i] = false;
    afterMove();
    return;
  }

  if (!d) return;

  if (mode === 'pen') {
    if (gameState.board[i] === d) {
      pushUndo();
      gameState.board[i] = 0;
      gameState.notes[i] = 0;
      gameState.revealed[i] = false;
      gameState.errors[i] = false;
      afterMove();
      return;
    }
    if (!isValidPlacement(gameState.board, i, d)) {
      flashInvalid(i);
      return;
    }
    pushUndo();
    gameState.board[i] = d;
    gameState.notes[i] = 0;
    gameState.revealed[i] = false;
    gameState.errors[i] = false;
    for (const p of PEERS[i]) {
      gameState.notes[p] &= ~bit(d);
    }
    afterMove();
    return;
  }

  if (gameState.board[i] !== 0) return;
  const nextMask = toggleNote(gameState.notes[i], d);
  if (nextMask === gameState.notes[i]) return;
  pushUndo();
  gameState.notes[i] = nextMask;
  gameState.revealed[i] = false;
  gameState.errors[i] = false;
  afterMove();
}

function afterMove() {
  renderBoard();
  renderKeypad();
  scheduleSave();
  if (isSolved()) {
    onWin();
  }
}

function onWin() {
  if (gameState.completed) return;
  gameState.completed = true;
  setStatus('Puzzle solved!');
  saveGame(gameState.diff);
  showWinModal();
}

function isSolved() {
  if (!gameState) return false;
  for (let i = 0; i < 81; i++) {
    if (gameState.board[i] !== gameState.solution[i]) return false;
  }
  return true;
}

function onBoardClick(ev) {
  if (!gameState) return;
  if (!modalEl.classList.contains('hidden')) return;
  const cell = ev.target.closest('.cell');
  if (!cell) return;
  const i = Number(cell.dataset.i);
  gameState.selection = { i };
  renderBoard();
  applyInputToCell(i, gameState.input.digit);
}

function onBoardAuxClick(ev) {
  if (!gameState) return;
  if (!modalEl.classList.contains('hidden')) return;
  if (ev.button !== 1) return;
  const cell = ev.target.closest('.cell');
  if (!cell) return;
  ev.preventDefault();
  const i = Number(cell.dataset.i);
  gameState.selection = { i };
  renderBoard();
  const d = gameState.input.digit;
  if (!d) return;
  if (gameState.input.mode === 'pen') {
    applyInputToCell(i, d, 'pencil');
  } else if (gameState.input.mode === 'pencil') {
    applyInputToCell(i, d, 'pen');
  }
}

function onKeypadClick(ev) {
  if (!gameState) return;
  const key = ev.target.closest('.key');
  if (!key) return;
  if (key.dataset.digit) {
    setDigit(Number(key.dataset.digit), false);
    return;
  }
  const tool = key.dataset.tool;
  if (tool === 'pencil') {
    gameState.input.mode = gameState.input.mode === 'pencil' ? 'pen' : 'pencil';
    updateLabels();
    renderKeypad();
    return;
  }
  if (tool === 'eraser') {
    setEraser(false);
    return;
  }
  if (tool === 'undo') {
    undoLastMove();
  }
}

function setDigit(d, applyNow) {
  if (!gameState) return;
  if (gameState.input.mode === 'eraser') {
    gameState.input.mode = 'pen';
  }
  gameState.input.digit = d;
  updateLabels();
  renderKeypad();
  renderBoard();
  if (applyNow && gameState.selection) {
    applyInputToCell(gameState.selection.i, d);
  }
}

function setEraser(applyNow) {
  if (!gameState) return;
  gameState.input.mode = 'eraser';
  gameState.input.digit = null;
  updateLabels();
  renderKeypad();
  renderBoard();
  if (applyNow && gameState.selection) {
    applyInputToCell(gameState.selection.i, 0);
  }
}

function snapshotState() {
  return {
    board: gameState.board.slice(),
    notes: gameState.notes.slice(),
    revealed: gameState.revealed.slice(),
    errors: gameState.errors.slice(),
    completed: gameState.completed,
    selection: gameState.selection ? { i: gameState.selection.i } : null,
    input: { mode: gameState.input.mode, digit: gameState.input.digit },
  };
}

function pushUndo() {
  if (!gameState) return;
  undoStack.push(snapshotState());
  if (undoStack.length > UNDO_LIMIT) {
    undoStack.shift();
  }
}

function undoLastMove() {
  if (!gameState) return;
  const prev = undoStack.pop();
  if (!prev) {
    setStatus('Nothing to undo.');
    return;
  }
  gameState.board = prev.board.slice();
  gameState.notes = prev.notes.slice();
  gameState.revealed = prev.revealed.slice();
  gameState.errors = prev.errors.slice();
  gameState.completed = prev.completed;
  gameState.selection = prev.selection ? { i: prev.selection.i } : null;
  gameState.input.mode = prev.input.mode;
  gameState.input.digit = prev.input.digit;
  updateLabels();
  renderBoard();
  renderKeypad();
  setStatus('Undid.');
  saveGame(gameState.diff);
}

function resetBoard() {
  if (!gameState) return;
  closeWinModal();
  gameState.board = gameState.puzzle.slice();
  gameState.notes = Array(81).fill(0);
  gameState.revealed = Array(81).fill(false);
  gameState.errors = Array(81).fill(false);
  gameState.completed = false;
  gameState.selection = null;
  gameState.input.mode = 'pen';
  gameState.input.digit = null;
  updateLabels();
  undoStack.length = 0;
  renderBoard();
  renderKeypad();
  setStatus('Reset puzzle.');
  saveGame(gameState.diff);
}

function solvePuzzle() {
  if (!gameState) return;
  closeWinModal();
  gameState.board = gameState.solution.slice();
  gameState.notes = Array(81).fill(0);
  gameState.revealed = gameState.fixed.map((v) => !v);
  gameState.errors = Array(81).fill(false);
  gameState.completed = true;
  gameState.selection = null;
  gameState.input.mode = 'pen';
  gameState.input.digit = null;
  updateLabels();
  undoStack.length = 0;
  renderBoard();
  renderKeypad();
  setStatus('Solved.');
  saveGame(gameState.diff);
}

function revealHint() {
  if (!gameState || gameState.completed) return;
  const empty = [];
  for (let i = 0; i < 81; i++) {
    if (gameState.fixed[i]) continue;
    if (gameState.board[i] === 0) empty.push(i);
  }
  if (empty.length === 0) {
    setStatus('No empty cells for a hint.');
    return;
  }

  // Hints are intentionally independent of the current selection. Always
  // reveal a uniformly random empty editable cell.
  const pick = empty[Math.floor(Math.random() * empty.length)];
  const digit = gameState.solution[pick];

  pushUndo();
  gameState.board[pick] = digit;
  gameState.notes[pick] = 0;
  gameState.revealed[pick] = true;
  gameState.errors[pick] = false;
  gameState.selection = { i: pick };
  for (const peer of PEERS[pick]) {
    gameState.notes[peer] &= ~bit(digit);
  }

  renderBoard();
  renderKeypad();
  flashHint(pick);
  saveGame(gameState.diff);
  if (isSolved()) {
    onWin();
  } else {
    setStatus(`Hint: row ${row(pick) + 1}, column ${col(pick) + 1} is ${digit}.`);
  }
}

function validateBoard() {
  if (!gameState) return;
  let hasErrors = false;
  for (let i = 0; i < 81; i++) {
    if (gameState.fixed[i]) {
      gameState.errors[i] = false;
      continue;
    }
    const v = gameState.board[i];
    if (v === 0) {
      gameState.errors[i] = false;
      continue;
    }
    const wrong = v !== gameState.solution[i];
    gameState.errors[i] = wrong;
    if (wrong) hasErrors = true;
  }
  renderBoard();
  if (hasErrors) {
    setStatus('Puzzle has errors.');
  } else {
    setStatus('All guesses are valid!');
  }
  saveGame(gameState.diff);
}

function setSettingsOpen(open) {
  if (!settingsMenu || !settingsToggle) return;
  settingsMenu.classList.toggle('hidden', !open);
  settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleSettings() {
  if (!settingsMenu) return;
  const open = settingsMenu.classList.contains('hidden');
  setSettingsOpen(open);
}

function moveSelection(dr, dc) {
  if (!gameState) return;
  let i = gameState.selection ? gameState.selection.i : idx(4, 4);
  let r = row(i) + dr;
  let c = col(i) + dc;
  r = clamp(r, 0, 8);
  c = clamp(c, 0, 8);
  gameState.selection = { i: idx(r, c) };
  renderBoard();
}

function handleKeyDown(ev) {
  if (appState.screen !== 'game') return;
  if (!modalEl.classList.contains('hidden')) return;
  const key = ev.key;

  if (key >= '1' && key <= '9') {
    setDigit(Number(key), true);
    ev.preventDefault();
    return;
  }
  if (key === 'p' || key === 'P') {
    gameState.input.mode = gameState.input.mode === 'pencil' ? 'pen' : 'pencil';
    updateLabels();
    renderKeypad();
    ev.preventDefault();
    return;
  }
  if (key === 'e' || key === 'E') {
    setEraser(true);
    ev.preventDefault();
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    if (gameState.selection) {
      applyInputToCell(gameState.selection.i, 0);
    }
    ev.preventDefault();
    return;
  }
  if (key === 'ArrowUp') {
    moveSelection(-1, 0);
    ev.preventDefault();
    return;
  }
  if (key === 'ArrowDown') {
    moveSelection(1, 0);
    ev.preventDefault();
    return;
  }
  if (key === 'ArrowLeft') {
    moveSelection(0, -1);
    ev.preventDefault();
    return;
  }
  if (key === 'ArrowRight') {
    moveSelection(0, 1);
    ev.preventDefault();
    return;
  }
}

function scheduleSave() {
  if (!gameState || !gameState.diff) return;
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    if (!gameState || !gameState.diff) return;
    saveGame(gameState.diff);
  }, SAVE_THROTTLE_MS);
}

function saveGame(diff) {
  if (!gameState || !diff) return;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const payload = {
    version: 1,
    diff,
    startedAt: gameState.startedAt,
    elapsedMs: Date.now() - gameState.startedAt,
    puzzle: gameState.puzzle,
    solution: gameState.solution,
    board: gameState.board,
    fixed: gameState.fixed.map((v) => (v ? 1 : 0)),
    notes: gameState.notes,
    revealed: gameState.revealed,
    errors: gameState.errors,
    completed: gameState.completed,
  };
  try {
    localStorage.setItem(`sudoku_save_${diff}`, JSON.stringify(payload));
  } catch (err) {
    // ignore save errors
  }
}

function loadGame(diff) {
  try {
    const raw = localStorage.getItem(`sudoku_save_${diff}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.diff !== diff) return null;
    if (!Array.isArray(data.puzzle) || data.puzzle.length !== 81) return null;
    if (!Array.isArray(data.solution) || data.solution.length !== 81) return null;
    if (!Array.isArray(data.board) || data.board.length !== 81) return null;
    if (!Array.isArray(data.fixed) || data.fixed.length !== 81) return null;
    if (!Array.isArray(data.notes) || data.notes.length !== 81) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function resumeGame(saved) {
  closeWinModal();
  const revealed = Array.isArray(saved.revealed) && saved.revealed.length === 81
    ? saved.revealed.map((v) => Boolean(v))
    : Array(81).fill(false);
  const errors = Array.isArray(saved.errors) && saved.errors.length === 81
    ? saved.errors.map((v) => Boolean(v))
    : Array(81).fill(false);
  gameState = {
    diff: saved.diff,
    puzzle: saved.puzzle.slice(),
    solution: saved.solution.slice(),
    board: saved.board.slice(),
    fixed: saved.fixed.map((v) => Boolean(v)),
    notes: saved.notes.slice(),
    revealed,
    errors,
    selection: null,
    input: { mode: 'pen', digit: null },
    completed: Boolean(saved.completed),
    startedAt: saved.startedAt || Date.now(),
    elapsedMs: saved.elapsedMs || 0,
  };
  updateLabels();
  renderBoard();
  renderKeypad();
  showScreen('game');
  setStatus(saved.completed ? 'Puzzle solved!' : 'Resumed puzzle.');
  undoStack.length = 0;
}

function startNewGame(diff) {
  closeWinModal();
  const result = generatePuzzle(diff);
  gameState = {
    diff,
    puzzle: result.puzzle,
    solution: result.solution,
    board: result.puzzle.slice(),
    fixed: result.puzzle.map((v) => v !== 0),
    notes: Array(81).fill(0),
    revealed: Array(81).fill(false),
    errors: Array(81).fill(false),
    selection: null,
    input: { mode: 'pen', digit: null },
    completed: false,
    startedAt: Date.now(),
    elapsedMs: 0,
  };
  updateLabels();
  renderBoard();
  renderKeypad();
  showScreen('game');
  setStatus(`${DIFF_LABELS[diff]} puzzle`);
  saveGame(diff);
  undoStack.length = 0;
}

function backToTitle() {
  if (gameState) {
    saveGame(gameState.diff);
  }
  closeWinModal();
  showScreen('title');
}

function openModal(text, onYes, onNo = () => {}) {
  modalTextEl.textContent = text;
  modalEl.classList.remove('hidden');

  const cleanup = () => {
    modalEl.classList.add('hidden');
    modalYesBtn.onclick = null;
    modalNoBtn.onclick = null;
  };

  modalYesBtn.onclick = () => {
    cleanup();
    onYes();
  };

  modalNoBtn.onclick = () => {
    cleanup();
    onNo();
  };

  window.requestAnimationFrame(() => modalYesBtn.focus());
}

function openInstructionsModal() {
  if (!instructionsModal) return;
  instructionsModal.classList.remove('hidden');
}

function closeInstructionsModal() {
  if (!instructionsModal) return;
  instructionsModal.classList.add('hidden');
}

function onPickDifficulty(diff) {
  const saved = loadGame(diff);
  if (saved && !saved.completed) {
    openModal('Start a new game? No to resume previous.', () => {
      startNewGame(diff);
    }, () => {
      resumeGame(saved);
    });
    return;
  }
  startNewGame(diff);
}

function attachEvents() {
  document.addEventListener('keydown', handleKeyDown);
  quitBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  if (instructionsBtn) {
    instructionsBtn.addEventListener('click', () => {
      openInstructionsModal();
    });
  }
  if (instructionsCloseBtn) {
    instructionsCloseBtn.addEventListener('click', () => {
      closeInstructionsModal();
    });
  }
  if (instructionsModal) {
    instructionsModal.addEventListener('click', (ev) => {
      if (ev.target === instructionsModal) closeInstructionsModal();
    });
  }
  if (winClose) {
    winClose.addEventListener('click', () => {
      closeWinModal();
    });
  }
  if (winNew) {
    winNew.addEventListener('click', () => {
      if (gameState && gameState.diff) {
        closeWinModal();
        startNewGame(gameState.diff);
      }
    });
  }
  if (winReplay) {
    winReplay.addEventListener('click', () => {
      closeWinModal();
      resetBoard();
    });
  }
  if (winModal) {
    winModal.addEventListener('click', (ev) => {
      if (ev.target === winModal) closeWinModal();
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && instructionsModal && !instructionsModal.classList.contains('hidden')) {
      closeInstructionsModal();
    }
    if (ev.key === 'Escape' && winModal && !winModal.classList.contains('hidden')) {
      closeWinModal();
    }
  });
  if (settingsToggle) {
    settingsToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleSettings();
    });
  }
  if (settingsMenu) {
    settingsMenu.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      setSettingsOpen(false);
      if (action === 'new') {
        if (gameState && gameState.diff) {
          startNewGame(gameState.diff);
        }
        return;
      }
      if (action === 'reset') {
        resetBoard();
        return;
      }
      if (action === 'solve') {
        solvePuzzle();
        return;
      }
      if (action === 'hint') {
        openModal('Reveal a random empty cell?', () => {
          revealHint();
        }, () => {});
        return;
      }
      if (action === 'validate') {
        validateBoard();
        return;
      }
      if (action === 'back') {
        backToTitle();
        return;
      }
      if (action === 'theme') {
        const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        setTheme(next);
      }
    });
  }
  document.addEventListener('click', (ev) => {
    if (!settingsMenu || !settingsToggle) return;
    if (settingsMenu.classList.contains('hidden')) return;
    const target = ev.target;
    if (target instanceof Node) {
      if (settingsMenu.contains(target) || settingsToggle.contains(target)) return;
    }
    setSettingsOpen(false);
  });
  const diffButtons = document.querySelectorAll('[data-diff]');
  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.diff;
      if (!DIFFS.includes(diff)) return;
      onPickDifficulty(diff);
    });
  });
}

buildBoard();
buildKeypad();
attachEvents();
initTheme();
showScreen('title');
