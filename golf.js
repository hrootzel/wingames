import { CardRenderer, SUITS } from './card_renderer.js';

const TABLEAU_COLS = 7;
const TABLEAU_ROWS = 5;
const DEFAULT_STACK_SPACING = 24;
const DEFAULT_WASTE_SPACING = 16;

const STORAGE_KEY = 'golfOptions';
const DEFAULT_OPTIONS = {
  wrapAK: true,
  kingRule: 'Q_AND_A',
  startWasteEmpty: false,
  scoringMode: 'STROKES',
  holes: 1,
  autoFlipWhenNoMoves: false,
  showHints: false,
};

const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const tableauEl = document.getElementById('tableau');
const scoreLabelEl = document.getElementById('score-label');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const holeRowEl = document.getElementById('hole-row');
const holeEl = document.getElementById('hole');
const totalRowEl = document.getElementById('total-row');
const totalEl = document.getElementById('total');
const newBtn = document.getElementById('new-game');
const flipBtn = document.getElementById('flip-stock');
const undoBtn = document.getElementById('undo');
const optionsBtn = document.getElementById('options');

const optionsModal = document.getElementById('options-modal');
const optionsCloseBtn = document.getElementById('options-close');
const optWrap = document.getElementById('opt-wrap-ak');
const optKingRule = document.getElementById('opt-king-rule');
const optStartEmpty = document.getElementById('opt-start-empty');
const optScoring = document.getElementById('opt-scoring');
const optHoles = document.getElementById('opt-holes');
const optAutoFlip = document.getElementById('opt-auto-flip');
const optShowHints = document.getElementById('opt-show-hints');

const resultModal = document.getElementById('result-modal');
const resultTitleEl = document.getElementById('result-title');
const resultMessageEl = document.getElementById('result-message');
const scorecardEl = document.getElementById('scorecard');
const resultNextBtn = document.getElementById('result-next');
const resultRestartBtn = document.getElementById('result-restart');

const cardRenderer = new CardRenderer();

cardRenderer.applyStackRowClasses(tableauEl);

const layoutRoot = document.getElementById('app') || document.body;
let layoutMetrics = readLayoutMetrics();

function readLayoutMetrics() {
  const styles = getComputedStyle(layoutRoot);
  const stackSpacing = parseFloat(styles.getPropertyValue('--stack-spacing')) || DEFAULT_STACK_SPACING;
  const wasteSpacing = parseFloat(styles.getPropertyValue('--waste-spacing')) || DEFAULT_WASTE_SPACING;
  return { stackSpacing, wasteSpacing };
}

function refreshLayoutMetrics() {
  layoutMetrics = readLayoutMetrics();
}

let options = loadOptions();
let state = null;
let undoSnapshot = null;
let timerId = null;

function loadOptions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_OPTIONS };
  try {
    const parsed = JSON.parse(raw);
    return {
      wrapAK: parsed.wrapAK !== false,
      kingRule: ['STRICT', 'Q_ONLY', 'Q_AND_A'].includes(parsed.kingRule) ? parsed.kingRule : DEFAULT_OPTIONS.kingRule,
      startWasteEmpty: parsed.startWasteEmpty === true,
      scoringMode: ['STROKES', 'ARCADE', 'CARDS_LEFT'].includes(parsed.scoringMode) ? parsed.scoringMode : DEFAULT_OPTIONS.scoringMode,
      holes: parsed.holes === 9 ? 9 : 1,
      autoFlipWhenNoMoves: parsed.autoFlipWhenNoMoves === true,
      showHints: typeof parsed.showHints === 'boolean' ? parsed.showHints : DEFAULT_OPTIONS.showHints,
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

function saveOptions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}

function syncOptionsForm() {
  optWrap.checked = options.wrapAK;
  optKingRule.value = options.kingRule;
  optStartEmpty.checked = options.startWasteEmpty;
  optScoring.value = options.scoringMode;
  optHoles.value = String(options.holes);
  optAutoFlip.checked = options.autoFlipWhenNoMoves;
  optShowHints.checked = options.showHints;
}

function scoreLabelFor(mode) {
  if (mode === 'ARCADE') return 'Score';
  if (mode === 'CARDS_LEFT') return 'Cards left';
  return 'Strokes';
}

function updateHoleVisibility() {
  const show = options.holes > 1;
  holeRowEl.classList.toggle('hidden', !show);
  totalRowEl.classList.toggle('hidden', !show);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
  if (timerId !== null) return;
  timerId = setInterval(() => {
    if (!state || !state.started || state.holeOver) return;
    state.timeSeconds += 1;
    updateHud();
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ id: id++, suit, value, faceUp: true });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealHole() {
  const deck = createDeck();
  shuffle(deck);
  const tableau = Array.from({ length: TABLEAU_COLS }, () => []);
  for (let row = 0; row < TABLEAU_ROWS; row++) {
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const card = deck.pop();
      if (card) tableau[col].push(card);
    }
  }
  const waste = [];
  if (!options.startWasteEmpty) {
    const card = deck.pop();
    if (card) waste.push(card);
  }
  const stock = deck;
  return { tableau, stock, waste };
}

function buildHoleState(base) {
  const { tableau, stock, waste } = dealHole();
  return {
    ...base,
    tableau,
    stock,
    waste,
    moves: 0,
    timeSeconds: 0,
    score: 0,
    started: false,
    holeOver: false,
    won: false,
  };
}

function newGame() {
  closeModal(resultModal);
  stopTimer();
  const base = {
    holeIndex: 1,
    holeScores: Array.from({ length: options.holes }, () => null),
    totalScore: 0,
  };
  state = buildHoleState(base);
  undoSnapshot = null;
  updateStatus('Ready');
  render();
}

function advanceHole() {
  closeModal(resultModal);
  if (!state) return;
  if (state.holeIndex >= options.holes) {
    newGame();
    return;
  }
  stopTimer();
  const base = {
    holeIndex: state.holeIndex + 1,
    holeScores: state.holeScores.slice(),
    totalScore: state.totalScore,
  };
  state = buildHoleState(base);
  undoSnapshot = null;
  updateStatus('Ready');
  render();
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function setUndoSnapshot() {
  undoSnapshot = cloneState(state);
  updateUndoButton();
}

function updateUndoButton() {
  const disabled = !undoSnapshot || !state || state.holeOver;
  undoBtn.disabled = disabled;
}

function undo() {
  if (!undoSnapshot || !state || state.holeOver) return;
  state = cloneState(undoSnapshot);
  undoSnapshot = null;
  if (!state.started || state.holeOver) {
    stopTimer();
  } else {
    startTimer();
  }
  updateStatus('Undid the last move.');
  render();
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function countTableauCards() {
  return state.tableau.reduce((sum, col) => sum + col.length, 0);
}

function getWasteTop() {
  if (!state.waste.length) return null;
  return state.waste[state.waste.length - 1];
}

function isAdjacentRank(a, b) {
  if (Math.abs(a - b) === 1) return true;
  if (!options.wrapAK) return false;
  return (a === 1 && b === 13) || (a === 13 && b === 1);
}

function canPlayOnKing(srcRank) {
  if (options.kingRule === 'STRICT') return false;
  if (options.kingRule === 'Q_ONLY') return srcRank === 12;
  if (options.kingRule === 'Q_AND_A') return srcRank === 12 || (options.wrapAK && srcRank === 1);
  return false;
}

function isLegalTableauToWaste(card, wasteTop) {
  if (!card) return false;
  if (!wasteTop) return true;
  if (wasteTop.value === 13) {
    return canPlayOnKing(card.value);
  }
  return isAdjacentRank(card.value, wasteTop.value);
}

function findLegalMoves() {
  const moves = [];
  const wasteTop = getWasteTop();
  for (let col = 0; col < TABLEAU_COLS; col++) {
    const stack = state.tableau[col];
    if (!stack.length) continue;
    const card = stack[stack.length - 1];
    if (isLegalTableauToWaste(card, wasteTop)) {
      moves.push(col);
    }
  }
  return moves;
}

function hasLegalMoves() {
  return findLegalMoves().length > 0;
}

function displayScore() {
  if (!state) return 0;
  const remaining = countTableauCards();
  if (options.scoringMode === 'ARCADE') return state.score;
  if (options.scoringMode === 'CARDS_LEFT') return remaining;
  if (remaining === 0) return -state.stock.length;
  return remaining;
}

function calculateHoleScore() {
  if (options.scoringMode === 'ARCADE') return state.score;
  return displayScore();
}

function updateHud() {
  if (!state) return;
  scoreLabelEl.textContent = scoreLabelFor(options.scoringMode);
  scoreEl.textContent = String(displayScore());
  movesEl.textContent = String(state.moves);
  timeEl.textContent = formatTime(state.timeSeconds);
  if (options.holes > 1) {
    holeEl.textContent = `${state.holeIndex} / ${options.holes}`;
    totalEl.textContent = String(state.totalScore);
  }
  updateUndoButton();
}

function registerAction() {
  state.moves += 1;
  if (!state.started) {
    state.started = true;
    startTimer();
  }
}

function moveTableauToWaste(colIdx) {
  const stack = state.tableau[colIdx];
  if (!stack || stack.length === 0) return false;
  const card = stack[stack.length - 1];
  if (!isLegalTableauToWaste(card, getWasteTop())) return false;
  stack.pop();
  state.waste.push(card);
  if (options.scoringMode === 'ARCADE') {
    state.score += 10;
  }
  registerAction();
  return true;
}

function flipStock() {
  const card = state.stock.pop();
  if (!card) return false;
  state.waste.push(card);
  if (options.scoringMode === 'ARCADE') {
    state.score -= 5;
  }
  registerAction();
  return true;
}

function autoFlipIfStuck() {
  if (!options.autoFlipWhenNoMoves || state.holeOver) return false;
  let flipped = false;
  while (state.stock.length > 0 && !hasLegalMoves()) {
    if (!flipStock()) break;
    flipped = true;
  }
  return flipped;
}

function checkForHoleEnd() {
  const remaining = countTableauCards();
  if (remaining === 0) {
    finishHole(true);
    return;
  }
  if (state.stock.length === 0 && !hasLegalMoves()) {
    finishHole(false);
  }
}

function sumScores(scores) {
  return scores.reduce((sum, score) => sum + (Number.isFinite(score) ? score : 0), 0);
}

function finishHole(won) {
  state.holeOver = true;
  state.won = won;
  undoSnapshot = null;
  stopTimer();
  if (won && options.scoringMode === 'ARCADE') {
    state.score += 100;
  }
  const holeScore = calculateHoleScore();
  state.holeScores[state.holeIndex - 1] = holeScore;
  state.totalScore = sumScores(state.holeScores);
  updateStatus(won ? 'Hole cleared!' : 'No moves left.');
  render();
  showResultModal(won, holeScore);
}

function showResultModal(won, holeScore) {
  const scoreLabel = scoreLabelFor(options.scoringMode);
  const holeLabel = options.holes > 1 ? `Hole ${state.holeIndex} of ${options.holes}` : 'Hole';
  const outcome = won ? 'cleared' : 'ended';
  const totalText = options.holes > 1 ? ` Total: ${state.totalScore}.` : '';
  resultTitleEl.textContent = won ? 'Hole Complete' : 'Hole Over';
  resultMessageEl.textContent = `${holeLabel} ${outcome}. ${scoreLabel}: ${holeScore}.${totalText}`;
  renderScorecard();
  const hasNext = state.holeIndex < options.holes;
  resultNextBtn.classList.toggle('hidden', !hasNext);
  resultRestartBtn.textContent = hasNext ? 'Restart' : 'New Game';
  openModal(resultModal);
}

function renderScorecard() {
  scorecardEl.innerHTML = '';
  if (options.holes <= 1) {
    scorecardEl.classList.add('hidden');
    return;
  }
  scorecardEl.classList.remove('hidden');
  state.holeScores.forEach((score, idx) => {
    const item = document.createElement('div');
    item.className = 'scorecard-item';
    const label = document.createElement('div');
    label.textContent = `Hole ${idx + 1}`;
    const value = document.createElement('div');
    value.textContent = score == null ? '-' : String(score);
    item.appendChild(label);
    item.appendChild(value);
    scorecardEl.appendChild(item);
  });
}

function renderStock() {
  stockEl.innerHTML = '';
  const back = document.createElement('div');
  back.className = 'card-back';
  if (state.stock.length === 0) back.classList.add('empty');
  stockEl.appendChild(back);
  const count = document.createElement('div');
  count.className = 'stock-count';
  count.textContent = String(state.stock.length);
  if (state.stock.length === 0) count.classList.add('empty');
  stockEl.appendChild(count);
}

function renderWaste() {
  wasteEl.innerHTML = '';
  const visible = Math.min(3, state.waste.length);
  const start = state.waste.length - visible;
  for (let i = 0; i < visible; i++) {
    const card = state.waste[start + i];
    const el = cardRenderer.createCardElement(card);
    el.dataset.pile = 'waste';
    el.dataset.index = String(start + i);
    el.style.left = `${i * layoutMetrics.wasteSpacing}px`;
    el.style.zIndex = String(i);
    wasteEl.appendChild(el);
  }
  wasteEl.classList.toggle('empty', state.waste.length === 0);
}

function renderTableau() {
  tableauEl.innerHTML = '';
  const wasteTop = getWasteTop();
  const playable = new Set();
  if (options.showHints && !state.holeOver) {
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const stack = state.tableau[col];
      if (!stack.length) continue;
      const card = stack[stack.length - 1];
      if (isLegalTableauToWaste(card, wasteTop)) {
        playable.add(col);
      }
    }
  }
  state.tableau.forEach((stack, colIdx) => {
    const col = cardRenderer.createStackElement({ className: 'tableau-col' });
    col.dataset.col = String(colIdx);
    stack.forEach((card, idx) => {
      const el = cardRenderer.createCardElement(card);
      el.dataset.pile = 'tableau';
      el.dataset.col = String(colIdx);
      el.dataset.index = String(idx);
      el.style.top = `${idx * layoutMetrics.stackSpacing}px`;
      if (idx === stack.length - 1 && playable.has(colIdx)) {
        el.classList.add('playable');
      }
      col.appendChild(el);
    });
    tableauEl.appendChild(col);
  });
}

function render() {
  if (!state) return;
  updateHoleVisibility();
  cardRenderer.updateScaleFromCSS();
  renderStock();
  renderWaste();
  renderTableau();
  updateHud();
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
}

function handleStockClick() {
  if (!state || state.holeOver) return;
  if (state.stock.length === 0) {
    updateStatus('No cards left in stock.');
    return;
  }
  setUndoSnapshot();
  flipStock();
  settleAfterAction('Flipped stock.');
}

function handleTableauClick(ev) {
  if (!state || state.holeOver) return;
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
  if (!cardEl) return;
  const colIdx = Number(cardEl.dataset.col);
  const stack = state.tableau[colIdx];
  if (!stack || !stack.length) return;
  const cardIndex = Number(cardEl.dataset.index);
  if (cardIndex !== stack.length - 1) {
    updateStatus('Only top cards are playable.');
    return;
  }
  if (!isLegalTableauToWaste(stack[cardIndex], getWasteTop())) {
    updateStatus('Not a legal move.');
    return;
  }
  setUndoSnapshot();
  moveTableauToWaste(colIdx);
  settleAfterAction('Moved to waste.');
}

function settleAfterAction(message) {
  checkForHoleEnd();
  if (state.holeOver) return;
  const autoFlipped = autoFlipIfStuck();
  checkForHoleEnd();
  if (state.holeOver) return;
  if (autoFlipped) {
    message = 'No moves. Auto-flipped stock.';
  } else if (!hasLegalMoves() && state.stock.length > 0 && !options.autoFlipWhenNoMoves) {
    message = 'No moves. Flip the stock.';
  }
  updateStatus(message);
  render();
}

function attachEvents() {
  stockEl.addEventListener('click', handleStockClick);
  flipBtn.addEventListener('click', handleStockClick);
  tableauEl.addEventListener('click', handleTableauClick);
  newBtn.addEventListener('click', newGame);
  undoBtn.addEventListener('click', undo);

  optionsBtn.addEventListener('click', () => {
    syncOptionsForm();
    openModal(optionsModal);
  });
  optionsCloseBtn.addEventListener('click', () => closeModal(optionsModal));
  optionsModal.addEventListener('click', (ev) => {
    if (ev.target === optionsModal) closeModal(optionsModal);
  });

  resultNextBtn.addEventListener('click', advanceHole);
  resultRestartBtn.addEventListener('click', newGame);

  optWrap.addEventListener('change', () => {
    options.wrapAK = optWrap.checked;
    saveOptions();
    newGame();
  });
  optKingRule.addEventListener('change', () => {
    options.kingRule = optKingRule.value;
    saveOptions();
    newGame();
  });
  optStartEmpty.addEventListener('change', () => {
    options.startWasteEmpty = optStartEmpty.checked;
    saveOptions();
    newGame();
  });
  optScoring.addEventListener('change', () => {
    options.scoringMode = optScoring.value;
    saveOptions();
    newGame();
  });
  optHoles.addEventListener('change', () => {
    options.holes = Number(optHoles.value) === 9 ? 9 : 1;
    saveOptions();
    newGame();
  });
  optAutoFlip.addEventListener('change', () => {
    options.autoFlipWhenNoMoves = optAutoFlip.checked;
    saveOptions();
  });
  optShowHints.addEventListener('change', () => {
    options.showHints = optShowHints.checked;
    saveOptions();
    render();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closeModal(optionsModal);
      closeModal(resultModal);
    }
  });

  window.addEventListener('resize', () => {
    if (!state) return;
    refreshLayoutMetrics();
    render();
  });
}

syncOptionsForm();
updateHoleVisibility();
attachEvents();
newGame();
