const DIFFS = ['easy', 'medium', 'hard', 'extreme'];
const DIFF_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};
const DIFF_PROFILE = {
  easy: { minClues: 36, maxClues: 40 },
  medium: { minClues: 32, maxClues: 35 },
  hard: { minClues: 28, maxClues: 31 },
  extreme: { minClues: 24, maxClues: 27 },
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

const cellEls = [];
const keyEls = [];

function idx(r, c) {
  return r * 9 + c;
}

function row(i) {
  return Math.floor(i / 9);
}

function col(i) {
  return i % 9;
}

function boxIndex(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function hasNote(mask, d) {
  return (mask & (1 << (d - 1))) !== 0;
}

function toggleNote(mask, d) {
  return mask ^ (1 << (d - 1));
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
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

function updateLabels() {
  if (!gameState) return;
  diffLabelEl.textContent = DIFF_LABELS[gameState.diff] || gameState.diff;
  const mode = gameState.input.mode;
  modeLabelEl.textContent = mode === 'pencil' ? 'Pencil' : (mode === 'eraser' ? 'Eraser' : 'Pen');
}

function buildBoard() {
  boardEl.innerHTML = '';
  cellEls.length = 0;
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
      for (let d = 1; d <= 9; d++) {
        const span = document.createElement('span');
        span.dataset.note = String(d);
        notesEl.appendChild(span);
      }

      cell.appendChild(valueEl);
      cell.appendChild(notesEl);
      boardEl.appendChild(cell);
      cellEls[i] = cell;
    }
  }
  boardEl.addEventListener('click', onBoardClick);
}

function buildKeypad() {
  keypadEl.innerHTML = '';
  keyEls.length = 0;
  const keys = [
    1, 2, 3, 4, 5, 6, 7, 8, 9,
    { tool: 'pencil', label: '✏️' },
    { tool: 'eraser', label: '🧽' },
    { tool: 'back', label: '↩️' },
  ];

  for (const k of keys) {
    const el = document.createElement('div');
    el.className = 'key';
    if (typeof k === 'number') {
      el.dataset.digit = String(k);
      el.textContent = String(k);
    } else {
      el.dataset.tool = k.tool;
      el.classList.add('tool');
      el.textContent = k.label;
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
  for (const key of keyEls) {
    key.classList.remove('active');
    const digit = key.dataset.digit ? Number(key.dataset.digit) : null;
    if (digit && digit === activeDigit && mode !== 'eraser') {
      key.classList.add('active');
    }
    const tool = key.dataset.tool;
    if (tool === 'pencil' && mode === 'pencil') key.classList.add('active');
    if (tool === 'eraser' && mode === 'eraser') key.classList.add('active');
  }
}

function renderBoard() {
  if (!gameState) return;
  for (let i = 0; i < 81; i++) {
    const cell = cellEls[i];
    const value = gameState.board[i];
    const fixed = gameState.fixed[i];

    cell.classList.toggle('fixed', fixed);
    cell.classList.toggle('selected', gameState.selection && gameState.selection.i === i);

    const valueEl = cell.querySelector('.value');
    const notesEl = cell.querySelector('.notes');

    if (value !== 0) {
      valueEl.textContent = String(value);
      notesEl.style.visibility = 'hidden';
    } else {
      valueEl.textContent = '';
      notesEl.style.visibility = 'visible';
      const mask = gameState.notes[i];
      for (let d = 1; d <= 9; d++) {
        const span = notesEl.querySelector(`span[data-note="${d}"]`);
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

function applyInputToCell(i, d) {
  if (!gameState || gameState.completed) return;
  if (gameState.fixed[i]) return;

  const mode = gameState.input.mode;
  if (mode === 'eraser') {
    gameState.board[i] = 0;
    gameState.notes[i] = 0;
    afterMove();
    return;
  }

  if (!d) return;

  if (mode === 'pen') {
    if (gameState.board[i] === d) {
      gameState.board[i] = 0;
      afterMove();
      return;
    }
    if (!isValidPlacement(gameState.board, i, d)) {
      flashInvalid(i);
      return;
    }
    gameState.board[i] = d;
    gameState.notes[i] = 0;
    afterMove();
    return;
  }

  if (gameState.board[i] !== 0) return;
  gameState.notes[i] = toggleNote(gameState.notes[i], d);
  afterMove();
}

function afterMove() {
  renderBoard();
  renderKeypad();
  saveGame(gameState.diff);
  if (isSolved()) {
    onWin();
  }
}

function onWin() {
  gameState.completed = true;
  setStatus('Puzzle solved!');
  saveGame(gameState.diff);
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

function onKeypadClick(ev) {
  if (!gameState) return;
  const key = ev.target.closest('.key');
  if (!key) return;
  if (key.dataset.digit) {
    setDigit(Number(key.dataset.digit));
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
    gameState.input.mode = 'eraser';
    gameState.input.digit = null;
    updateLabels();
    renderKeypad();
    if (gameState.selection) {
      applyInputToCell(gameState.selection.i, 0);
    }
    return;
  }
  if (tool === 'back') {
    backToTitle();
  }
}

function setDigit(d) {
  if (!gameState) return;
  if (gameState.input.mode === 'eraser') {
    gameState.input.mode = 'pen';
  }
  gameState.input.digit = d;
  updateLabels();
  renderKeypad();
  if (gameState.selection) {
    applyInputToCell(gameState.selection.i, d);
  }
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
    setDigit(Number(key));
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
    gameState.input.mode = 'eraser';
    gameState.input.digit = null;
    updateLabels();
    renderKeypad();
    if (gameState.selection) {
      applyInputToCell(gameState.selection.i, 0);
    }
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

function saveGame(diff) {
  if (!gameState || !diff) return;
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
  gameState = {
    diff: saved.diff,
    puzzle: saved.puzzle.slice(),
    solution: saved.solution.slice(),
    board: saved.board.slice(),
    fixed: saved.fixed.map((v) => Boolean(v)),
    notes: saved.notes.slice(),
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
}

function startNewGame(diff) {
  const result = generatePuzzle(diff);
  gameState = {
    diff,
    puzzle: result.puzzle,
    solution: result.solution,
    board: result.puzzle.slice(),
    fixed: result.puzzle.map((v) => v !== 0),
    notes: Array(81).fill(0),
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
}

function backToTitle() {
  if (gameState) {
    saveGame(gameState.diff);
  }
  showScreen('title');
}

function openModal(text, onYes, onNo) {
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

function getCandidates(board, i) {
  if (board[i] !== 0) return [];
  const used = new Set();
  const r = row(i);
  const c = col(i);
  for (let cc = 0; cc < 9; cc++) {
    const v = board[idx(r, cc)];
    if (v) used.add(v);
  }
  for (let rr = 0; rr < 9; rr++) {
    const v = board[idx(rr, c)];
    if (v) used.add(v);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      const v = board[idx(rr, cc)];
      if (v) used.add(v);
    }
  }
  const candidates = [];
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) candidates.push(d);
  }
  return candidates;
}

function findBestCell(board) {
  let best = null;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const candidates = getCandidates(board, i);
    if (candidates.length === 0) {
      return { i, candidates };
    }
    if (!best || candidates.length < best.candidates.length) {
      best = { i, candidates };
      if (candidates.length === 1) break;
    }
  }
  return best;
}

function solveBoard(board) {
  const spot = findBestCell(board);
  if (!spot) return true;
  if (spot.candidates.length === 0) return false;
  shuffle(spot.candidates);
  for (const d of spot.candidates) {
    board[spot.i] = d;
    if (solveBoard(board)) return true;
    board[spot.i] = 0;
  }
  return false;
}

function countSolutions(board, limit) {
  let count = 0;
  function search() {
    if (count >= limit) return;
    const spot = findBestCell(board);
    if (!spot) {
      count += 1;
      return;
    }
    if (spot.candidates.length === 0) return;
    for (const d of spot.candidates) {
      board[spot.i] = d;
      search();
      board[spot.i] = 0;
      if (count >= limit) return;
    }
  }
  search();
  return count;
}

function generateSolvedGrid() {
  const board = Array(81).fill(0);
  solveBoard(board);
  return board;
}

function countClues(board) {
  let clues = 0;
  for (const v of board) {
    if (v !== 0) clues += 1;
  }
  return clues;
}

function digHolesUnique(solution, minClues, maxClues) {
  const puzzle = solution.slice();
  const target = randomInt(minClues, maxClues);
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let clues = 81;
  for (const i of indices) {
    if (clues <= target) break;
    const backup = puzzle[i];
    puzzle[i] = 0;
    const unique = countSolutions(puzzle.slice(), 2) === 1;
    if (!unique) {
      puzzle[i] = backup;
    } else {
      clues -= 1;
    }
  }
  return puzzle;
}

function generatePuzzle(diff) {
  const profile = DIFF_PROFILE[diff] || DIFF_PROFILE.easy;
  let fallback = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = generateSolvedGrid();
    const puzzle = digHolesUnique(solution, profile.minClues, profile.maxClues);
    const clues = countClues(puzzle);
    if (clues >= profile.minClues && clues <= profile.maxClues) {
      return { puzzle, solution };
    }
    fallback = { puzzle, solution };
  }
  return fallback || { puzzle: Array(81).fill(0), solution: Array(81).fill(0) };
}

function attachEvents() {
  document.addEventListener('keydown', handleKeyDown);
  quitBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
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
showScreen('title');
