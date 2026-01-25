const DIFFS = ['easy', 'medium', 'hard', 'extreme'];
const DIFF_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};
const DIFF_PROFILE = {
  easy: { minClues: 36, maxClues: 40, maxLevel: 1, allowGuess: false, requireGuess: false },
  medium: { minClues: 32, maxClues: 35, maxLevel: 2, allowGuess: false, requireGuess: false },
  hard: { minClues: 28, maxClues: 31, maxLevel: 3, allowGuess: false, requireGuess: false },
  extreme: { minClues: 24, maxClues: 27, maxLevel: 4, allowGuess: true, requireGuess: true },
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

const ALL_MASK = (1 << 9) - 1;

function bit(d) {
  return 1 << (d - 1);
}

function popcount(x) {
  let count = 0;
  let v = x;
  while (v) {
    v &= v - 1;
    count += 1;
  }
  return count;
}

function firstDigit(mask) {
  return Math.floor(Math.log2(mask)) + 1;
}

function maskToDigits(mask) {
  const out = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & bit(d)) out.push(d);
  }
  return out;
}

const ROWS = Array.from({ length: 9 }, () => []);
const COLS = Array.from({ length: 9 }, () => []);
const BOXES = Array.from({ length: 9 }, () => []);

for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const i = idx(r, c);
    ROWS[r].push(i);
    COLS[c].push(i);
    const b = boxIndex(r, c);
    BOXES[b].push(i);
  }
}

const UNITS = ROWS.concat(COLS, BOXES);
const PEERS = Array.from({ length: 81 }, () => []);
{
  const peerSets = Array.from({ length: 81 }, () => new Set());
  for (const unit of UNITS) {
    for (const i of unit) {
      for (const j of unit) {
        if (i !== j) peerSets[i].add(j);
      }
    }
  }
  for (let i = 0; i < 81; i++) {
    PEERS[i] = Array.from(peerSets[i]);
  }
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

function candidateMask(board, i) {
  if (board[i] !== 0) return 0;
  let used = 0;
  for (const p of PEERS[i]) {
    const v = board[p];
    if (v) used |= bit(v);
  }
  return ALL_MASK & ~used;
}

function computeCandidates(board) {
  const cand = Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    cand[i] = candidateMask(board, i);
  }
  return cand;
}

function techNakedSingles(board, cand) {
  const actions = [];
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    if (popcount(cand[i]) === 1) {
      actions.push({ type: 'assign', i, d: firstDigit(cand[i]), level: 1 });
    }
  }
  return actions;
}

function techHiddenSingles(board, cand) {
  const actions = [];
  for (const unit of UNITS) {
    const count = Array(10).fill(0);
    const last = Array(10).fill(-1);
    for (const i of unit) {
      if (board[i] !== 0) continue;
      const mask = cand[i];
      for (let d = 1; d <= 9; d++) {
        if (mask & bit(d)) {
          count[d] += 1;
          last[d] = i;
        }
      }
    }
    for (let d = 1; d <= 9; d++) {
      if (count[d] === 1) {
        actions.push({ type: 'assign', i: last[d], d, level: 1 });
      }
    }
  }
  return actions;
}

function techLockedCandidates(board, cand) {
  const actions = [];

  for (let b = 0; b < 9; b++) {
    const box = BOXES[b];
    for (let d = 1; d <= 9; d++) {
      const cells = [];
      for (const i of box) {
        if (board[i] === 0 && (cand[i] & bit(d))) cells.push(i);
      }
      if (cells.length < 2) continue;

      const r0 = row(cells[0]);
      const c0 = col(cells[0]);
      const sameRow = cells.every((i) => row(i) === r0);
      const sameCol = cells.every((i) => col(i) === c0);

      if (sameRow) {
        for (const i of ROWS[r0]) {
          if (box.includes(i)) continue;
          if (board[i] === 0 && (cand[i] & bit(d))) {
            actions.push({ type: 'elim', i, mask: bit(d), level: 2 });
          }
        }
      }

      if (sameCol) {
        for (const i of COLS[c0]) {
          if (box.includes(i)) continue;
          if (board[i] === 0 && (cand[i] & bit(d))) {
            actions.push({ type: 'elim', i, mask: bit(d), level: 2 });
          }
        }
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    const unit = ROWS[r];
    for (let d = 1; d <= 9; d++) {
      const cells = [];
      for (const i of unit) {
        if (board[i] === 0 && (cand[i] & bit(d))) cells.push(i);
      }
      if (cells.length < 2) continue;
      const boxId = boxIndex(row(cells[0]), col(cells[0]));
      const sameBox = cells.every((i) => boxIndex(row(i), col(i)) === boxId);
      if (!sameBox) continue;
      for (const i of BOXES[boxId]) {
        if (row(i) === r) continue;
        if (board[i] === 0 && (cand[i] & bit(d))) {
          actions.push({ type: 'elim', i, mask: bit(d), level: 2 });
        }
      }
    }
  }

  for (let c = 0; c < 9; c++) {
    const unit = COLS[c];
    for (let d = 1; d <= 9; d++) {
      const cells = [];
      for (const i of unit) {
        if (board[i] === 0 && (cand[i] & bit(d))) cells.push(i);
      }
      if (cells.length < 2) continue;
      const boxId = boxIndex(row(cells[0]), col(cells[0]));
      const sameBox = cells.every((i) => boxIndex(row(i), col(i)) === boxId);
      if (!sameBox) continue;
      for (const i of BOXES[boxId]) {
        if (col(i) === c) continue;
        if (board[i] === 0 && (cand[i] & bit(d))) {
          actions.push({ type: 'elim', i, mask: bit(d), level: 2 });
        }
      }
    }
  }

  return actions;
}

function techNakedPairs(board, cand) {
  const actions = [];
  for (const unit of UNITS) {
    const pairs = new Map();
    for (const i of unit) {
      if (board[i] !== 0) continue;
      const mask = cand[i];
      if (popcount(mask) === 2) {
        const key = String(mask);
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push(i);
      }
    }
    for (const [key, cells] of pairs.entries()) {
      if (cells.length !== 2) continue;
      const mask = Number(key);
      for (const i of unit) {
        if (cells.includes(i)) continue;
        if (board[i] === 0 && (cand[i] & mask)) {
          actions.push({ type: 'elim', i, mask, level: 2 });
        }
      }
    }
  }
  return actions;
}

function techXWing(board, cand) {
  const actions = [];
  for (let d = 1; d <= 9; d++) {
    const rowPairs = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        const i = idx(r, c);
        if (board[i] === 0 && (cand[i] & bit(d))) cols.push(c);
      }
      if (cols.length === 2) {
        rowPairs.push({ r, c1: cols[0], c2: cols[1] });
      }
    }
    for (let a = 0; a < rowPairs.length; a++) {
      for (let b = a + 1; b < rowPairs.length; b++) {
        const A = rowPairs[a];
        const B = rowPairs[b];
        if (A.c1 !== B.c1 || A.c2 !== B.c2) continue;
        const cols = [A.c1, A.c2];
        for (const c of cols) {
          for (let r = 0; r < 9; r++) {
            if (r === A.r || r === B.r) continue;
            const i = idx(r, c);
            if (board[i] === 0 && (cand[i] & bit(d))) {
              actions.push({ type: 'elim', i, mask: bit(d), level: 3 });
            }
          }
        }
      }
    }
  }

  for (let d = 1; d <= 9; d++) {
    const colPairs = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) {
        const i = idx(r, c);
        if (board[i] === 0 && (cand[i] & bit(d))) rows.push(r);
      }
      if (rows.length === 2) {
        colPairs.push({ c, r1: rows[0], r2: rows[1] });
      }
    }
    for (let a = 0; a < colPairs.length; a++) {
      for (let b = a + 1; b < colPairs.length; b++) {
        const A = colPairs[a];
        const B = colPairs[b];
        if (A.r1 !== B.r1 || A.r2 !== B.r2) continue;
        const rows = [A.r1, A.r2];
        for (const r of rows) {
          for (let c = 0; c < 9; c++) {
            if (c === A.c || c === B.c) continue;
            const i = idx(r, c);
            if (board[i] === 0 && (cand[i] & bit(d))) {
              actions.push({ type: 'elim', i, mask: bit(d), level: 3 });
            }
          }
        }
      }
    }
  }

  return actions;
}

const TECHS = [
  techNakedSingles,
  techHiddenSingles,
  techLockedCandidates,
  techNakedPairs,
  techXWing,
];

function solveByTechniques(puzzle, allowGuess, maxGuessDepth) {
  const board = puzzle.slice();
  let cand = computeCandidates(board);
  const report = { solved: false, steps: 0, maxLevelUsed: 0, usedGuess: false };

  function applyActions(actions) {
    let assigned = false;
    for (const action of actions) {
      if (action.type === 'assign') {
        board[action.i] = action.d;
        assigned = true;
      }
      report.steps += 1;
      report.maxLevelUsed = Math.max(report.maxLevelUsed, action.level || 0);
    }
    if (assigned) {
      cand = computeCandidates(board);
    }
    for (const action of actions) {
      if (action.type === 'elim') {
        cand[action.i] &= ~action.mask;
      }
    }
  }

  function isComplete() {
    return board.every((v) => v !== 0);
  }

  while (true) {
    if (isComplete()) {
      report.solved = true;
      return { board, report };
    }

    let progressed = false;
    for (const tech of TECHS) {
      const actions = tech(board, cand);
      if (actions.length > 0) {
        applyActions(actions);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;

    if (!allowGuess || maxGuessDepth <= 0) {
      return { board, report };
    }

    report.usedGuess = true;
    let bestI = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const count = popcount(cand[i]);
      if (count === 0) return { board, report };
      if (count < bestCount) {
        bestCount = count;
        bestMask = cand[i];
        bestI = i;
        if (count === 1) break;
      }
    }

    if (bestI < 0) return { board, report };
    const digits = maskToDigits(bestMask);
    for (const d of digits) {
      const next = board.slice();
      next[bestI] = d;
      const sub = solveByTechniques(next, allowGuess, maxGuessDepth - 1);
      if (sub.report.solved) {
        for (let i = 0; i < 81; i++) {
          board[i] = sub.board[i];
        }
        report.steps += sub.report.steps;
        report.maxLevelUsed = Math.max(report.maxLevelUsed, 4, sub.report.maxLevelUsed);
        report.solved = true;
        return { board, report };
      }
    }

    return { board, report };
  }
}

function rateByLogicalSolve(puzzle, solution, allowGuess) {
  const { board, report } = solveByTechniques(puzzle, allowGuess, allowGuess ? 2 : 0);
  if (report.solved) {
    for (let i = 0; i < 81; i++) {
      if (board[i] !== solution[i]) {
        report.solved = false;
        break;
      }
    }
  }
  return report;
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
  const pick = empty[randomInt(0, empty.length - 1)];
  gameState.board[pick] = gameState.solution[pick];
  gameState.notes[pick] = 0;
  gameState.revealed[pick] = true;
  gameState.errors[pick] = false;
  renderBoard();
  renderKeypad();
  saveGame(gameState.diff);
  if (isSolved()) {
    onWin();
  } else {
    setStatus('Hint revealed.');
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

function findBestCell(board) {
  let bestI = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const mask = candidateMask(board, i);
    const count = popcount(mask);
    if (count === 0) {
      return { i, mask, count };
    }
    if (count < bestCount) {
      bestI = i;
      bestMask = mask;
      bestCount = count;
      if (count === 1) break;
    }
  }
  if (bestI < 0) return null;
  return { i: bestI, mask: bestMask, count: bestCount };
}

function solveBoard(board) {
  const spot = findBestCell(board);
  if (!spot) return true;
  if (spot.count === 0) return false;
  const digits = maskToDigits(spot.mask);
  shuffle(digits);
  for (const d of digits) {
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
    if (spot.count === 0) return;
    const digits = maskToDigits(spot.mask);
    for (const d of digits) {
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
  for (let attempt = 0; attempt < 120; attempt++) {
    const solution = generateSolvedGrid();
    const puzzle = digHolesUnique(solution, profile.minClues, profile.maxClues);
    const clues = countClues(puzzle);
    const report = rateByLogicalSolve(puzzle, solution, profile.allowGuess);
    if (!report.solved) {
      continue;
    }
    if (!profile.allowGuess && report.usedGuess) {
      continue;
    }
    if (profile.requireGuess && !report.usedGuess) {
      continue;
    }
    if (report.maxLevelUsed > profile.maxLevel) {
      continue;
    }
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
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && instructionsModal && !instructionsModal.classList.contains('hidden')) {
      closeInstructionsModal();
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
      if (action === 'reset') {
        resetBoard();
        return;
      }
      if (action === 'solve') {
        solvePuzzle();
        return;
      }
      if (action === 'hint') {
        openModal('Do you want a Hint?', () => {
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
