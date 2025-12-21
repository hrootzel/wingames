import { CardRenderer, SUITS, SUIT_SYMBOLS, cardColor } from './card_renderer.js';

const TABLEAU_COLS = 8;
const FREECELL_SLOTS = 4;
const FOUNDATION_SLOTS = 4;
const DEAL_MAX = 32000;
const VIEWPORT_BOTTOM_MARGIN = 28;
const TIGHTEN_START = 12;
const TIGHTEN_END = 28;

const SIZE_PRESETS = {
  sm: { width: 72, height: 100, spacing: 20 },
  md: { width: 88, height: 120, spacing: 24 },
  lg: { width: 104, height: 144, spacing: 28 },
};

const appEl = document.getElementById('app');
const freecellsEl = document.getElementById('freecells');
const foundationsEl = document.getElementById('foundations');
const tableauEl = document.getElementById('tableau');
const dealEl = document.getElementById('deal-number');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const newBtn = document.getElementById('new-game');
const selectGameBtn = document.getElementById('select-game');
const statsBtn = document.getElementById('stats');
const undoBtn = document.getElementById('undo');
const optionsBtn = document.getElementById('options');

const selectGameModal = document.getElementById('select-game-modal');
const selectGameInput = document.getElementById('select-game-input');
const selectGameOk = document.getElementById('select-game-ok');
const selectGameCancel = document.getElementById('select-game-cancel');

const statsModal = document.getElementById('stats-modal');
const statsPlayedEl = document.getElementById('stats-played');
const statsWonEl = document.getElementById('stats-won');
const statsWinrateEl = document.getElementById('stats-winrate');
const statsStreakEl = document.getElementById('stats-streak');
const statsBestStreakEl = document.getElementById('stats-best-streak');
const statsBestTimeEl = document.getElementById('stats-best-time');
const statsBestMovesEl = document.getElementById('stats-best-moves');
const statsCloseBtn = document.getElementById('stats-close');

const optionsModal = document.getElementById('options-modal');
const optDealMode = document.getElementById('opt-deal-mode');
const optSupermove = document.getElementById('opt-supermove');
const optDisableCap = document.getElementById('opt-disable-cap');
const optAutoFoundation = document.getElementById('opt-auto-foundation');
const optOutlineValid = document.getElementById('opt-outline-valid');
const optCardSize = document.getElementById('opt-card-size');
const optionsCloseBtn = document.getElementById('options-close');

const cardRenderer = new CardRenderer();

let options = loadOptions();
let cardMetrics = getCardMetrics(options.cardSize);
let stats = loadStats();

let state = null;
let selection = null;
let dragState = null;
let dropIndicator = null;
let undoStack = [];
let timerId = null;
let clickTracker = { cardKey: null, time: 0 };
let ignoreClicksUntil = 0;
let currentDealNumber = 1;

function getCardMetrics(sizeKey) {
  return SIZE_PRESETS[sizeKey] || SIZE_PRESETS.md;
}

function loadOptions() {
  const raw = localStorage.getItem('freecellOptions');
  if (!raw) {
    return {
      dealMode: 'microsoft',
      allowSupermove: true,
      disableSupermoveCap: false,
      autoFoundation: true,
      outlineValid: true,
      cardSize: 'md',
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      dealMode: parsed.dealMode === 'random' ? 'random' : 'microsoft',
      allowSupermove: parsed.allowSupermove !== false,
      disableSupermoveCap: parsed.disableSupermoveCap === true,
      autoFoundation: parsed.autoFoundation !== false,
      outlineValid: parsed.outlineValid !== false,
      cardSize: ['sm', 'md', 'lg'].includes(parsed.cardSize) ? parsed.cardSize : 'md',
    };
  } catch {
    return {
      dealMode: 'microsoft',
      allowSupermove: true,
      disableSupermoveCap: false,
      autoFoundation: true,
      outlineValid: true,
      cardSize: 'md',
    };
  }
}

function saveOptions() {
  localStorage.setItem('freecellOptions', JSON.stringify(options));
}

function loadStats() {
  const raw = localStorage.getItem('freecellStats');
  if (!raw) {
    return { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, bestStreak: 0, bestTime: null, bestMoves: null };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      gamesPlayed: parsed.gamesPlayed || 0,
      gamesWon: parsed.gamesWon || 0,
      currentStreak: parsed.currentStreak || 0,
      bestStreak: parsed.bestStreak || 0,
      bestTime: Number.isFinite(parsed.bestTime) ? parsed.bestTime : null,
      bestMoves: Number.isFinite(parsed.bestMoves) ? parsed.bestMoves : null,
    };
  } catch {
    return { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, bestStreak: 0, bestTime: null, bestMoves: null };
  }
}

function saveStats() {
  localStorage.setItem('freecellStats', JSON.stringify(stats));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
}

function updateStatsDisplay() {
  statsPlayedEl.textContent = String(stats.gamesPlayed);
  statsWonEl.textContent = String(stats.gamesWon);
  const winRate = stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  statsWinrateEl.textContent = `${winRate}%`;
  statsStreakEl.textContent = String(stats.currentStreak);
  statsBestStreakEl.textContent = String(stats.bestStreak);
  statsBestTimeEl.textContent = stats.bestTime != null ? formatTime(stats.bestTime) : '-';
  statsBestMovesEl.textContent = stats.bestMoves != null ? String(stats.bestMoves) : '-';
}

function recordGameEnd(won) {
  stats.gamesPlayed += 1;
  if (won) {
    stats.gamesWon += 1;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    if (stats.bestTime == null || state.timeSeconds < stats.bestTime) {
      stats.bestTime = state.timeSeconds;
    }
    if (stats.bestMoves == null || state.moves < stats.bestMoves) {
      stats.bestMoves = state.moves;
    }
  } else {
    stats.currentStreak = 0;
  }
  saveStats();
}

function applyOptions() {
  appEl.dataset.size = options.cardSize;
  document.body.dataset.size = options.cardSize;
  cardMetrics = getCardMetrics(options.cardSize);
  cardRenderer.size = options.cardSize;
  optDealMode.value = options.dealMode;
  optSupermove.checked = options.allowSupermove;
  optDisableCap.checked = options.disableSupermoveCap;
  optAutoFoundation.checked = options.autoFoundation;
  optOutlineValid.checked = options.outlineValid;
  optCardSize.value = options.cardSize;
  saveOptions();
  if (!options.outlineValid) clearDropIndicator();
  render();
}

function makeMsRand(seed) {
  let state = seed | 0;
  return {
    next() {
      state = (Math.imul(214013, state) + 2531011) & 0x7fffffff;
      return (state >>> 16) & 0x7fff;
    },
  };
}

function makeDeck() {
  const deck = [];
  let id = 0;
  for (let value = 1; value <= 13; value++) {
    for (const suit of SUITS) {
      deck.push({ id: id++, suit, value, faceUp: true });
    }
  }
  return deck;
}

function dealMicrosoft(gameNumber) {
  const rng = makeMsRand(gameNumber);
  const deck = makeDeck();
  const dealt = [];
  for (let remaining = deck.length; remaining > 0; remaining--) {
    const i = rng.next() % remaining;
    const last = remaining - 1;
    [deck[i], deck[last]] = [deck[last], deck[i]];
    dealt.push(deck[last]);
  }
  return dealRoundRobin(dealt);
}

function dealRandom() {
  const deck = makeDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return dealRoundRobin(deck);
}

function dealRoundRobin(cards) {
  const columns = Array.from({ length: TABLEAU_COLS }, () => []);
  cards.forEach((card, idx) => {
    columns[idx % TABLEAU_COLS].push(card);
  });
  return columns;
}

function resetState({ dealNumber, tableau }) {
  state = {
    tableau,
    freecells: Array.from({ length: FREECELL_SLOTS }, () => []),
    foundations: Array.from({ length: FOUNDATION_SLOTS }, () => []),
    dealNumber,
    moves: 0,
    timeSeconds: 0,
    started: false,
    won: false,
  };
  selection = null;
  dragState = null;
  undoStack = [];
  stopTimer();
  updateStatus('Ready');
  render();
}

function newGame({ dealNumber, randomize } = {}) {
  if (state && state.started && !state.won) {
    recordGameEnd(false);
  }
  if (options.dealMode === 'microsoft') {
    let nextNumber = dealNumber ?? currentDealNumber ?? 1;
    if (randomize) {
      nextNumber = 1 + Math.floor(Math.random() * DEAL_MAX);
    }
    const safeNumber = Math.max(1, Math.min(DEAL_MAX, nextNumber));
    currentDealNumber = safeNumber;
    resetState({ dealNumber: safeNumber, tableau: dealMicrosoft(safeNumber) });
  } else {
    currentDealNumber = null;
    resetState({ dealNumber: null, tableau: dealRandom() });
  }
}

function updateStatus(text, tone = 'normal') {
  statusEl.textContent = text;
  statusEl.classList.toggle('status-warning', tone === 'warning');
}

function updateHud() {
  dealEl.textContent = state.dealNumber ? String(state.dealNumber) : 'Random';
  movesEl.textContent = String(state.moves);
  timeEl.textContent = formatTime(state.timeSeconds);
  undoBtn.disabled = undoStack.length === 0;
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  if (timerId !== null) return;
  timerId = setInterval(() => {
    if (!state.started || state.won) return;
    state.timeSeconds += 1;
    updateHud();
  }, 1000);
}

function tableauSpacingForStack(stackLength, tableauTop) {
  if (stackLength <= 1) return cardMetrics.spacing;
  const availableHeight = Math.max(0, window.innerHeight - tableauTop - VIEWPORT_BOTTOM_MARGIN);
  const fitSpacing = (availableHeight - cardMetrics.height) / (stackLength - 1);
  const minSpacing = Math.max(10, Math.round(cardMetrics.spacing * 0.5));
  const t = stackLength <= TIGHTEN_START ? 0 : Math.min(1, (stackLength - TIGHTEN_START) / (TIGHTEN_END - TIGHTEN_START));
  const desiredSpacing = cardMetrics.spacing - t * (cardMetrics.spacing - minSpacing);
  return Math.max(0, Math.min(cardMetrics.spacing, desiredSpacing, fitSpacing));
}

function canPlaceOnTableau(card, stack) {
  if (stack.length === 0) return true;
  const top = stack[stack.length - 1];
  return cardColor(card.suit) !== cardColor(top.suit) && card.value === top.value - 1;
}

function canPlaceOnFoundation(card, stack, destIndex) {
  if (stack.length === 0) {
    return card.value === 1 && card.suit === SUITS[destIndex];
  }
  const top = stack[stack.length - 1];
  return card.suit === top.suit && card.value === top.value + 1;
}

function isValidTableauSequence(cards) {
  if (cards.length <= 1) return true;
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i];
    const b = cards[i + 1];
    if (cardColor(a.suit) === cardColor(b.suit)) return false;
    if (a.value !== b.value + 1) return false;
  }
  return true;
}

function countEmptyFreeCells(freePiles) {
  let n = 0;
  for (const pile of freePiles) {
    if (pile.length === 0) n += 1;
  }
  return n;
}

function countEmptyTableauCols(tableauPiles) {
  let n = 0;
  for (const col of tableauPiles) {
    if (col.length === 0) n += 1;
  }
  return n;
}

function emptyBufferCols(tableauPiles, destIsEmptyTableau) {
  const emptyCols = countEmptyTableauCols(tableauPiles);
  const usable = destIsEmptyTableau ? (emptyCols - 1) : emptyCols;
  return Math.max(0, usable);
}

function maxMovableToTableau({ tableauPiles, freePiles, destIsEmptyTableau }) {
  const free = countEmptyFreeCells(freePiles);
  const emptyBuffers = emptyBufferCols(tableauPiles, destIsEmptyTableau);
  return (free + 1) * (1 << emptyBuffers);
}

function maxMovableToNonEmptyTableau(tableauPiles, freePiles) {
  return maxMovableToTableau({ tableauPiles, freePiles, destIsEmptyTableau: false });
}

function maxMovableToEmptyTableau(tableauPiles, freePiles) {
  return maxMovableToTableau({ tableauPiles, freePiles, destIsEmptyTableau: true });
}

function getStack(source) {
  if (source.type === 'tableau') return state.tableau[source.index];
  if (source.type === 'freecell') return state.freecells[source.index];
  return state.foundations[source.index];
}

function peekSelectionCards(sel) {
  if (!sel) return [];
  const stack = getStack(sel.source);
  if (sel.source.type === 'tableau') {
    return stack.slice(sel.cardIndex);
  }
  const card = stack[stack.length - 1];
  return card ? [card] : [];
}

function isTopCardInTableau(sel) {
  if (!sel || sel.source.type !== 'tableau') return false;
  const stack = state.tableau[sel.source.index];
  return sel.cardIndex === stack.length - 1;
}

function setUndoSnapshot(source, dest, cards) {
  undoStack.push({ source, dest, cards: cards.slice() });
  undoBtn.disabled = undoStack.length === 0;
}

function applyMove(source, dest, cards) {
  const destStack = getStack(dest);
  destStack.push(...cards);
  setUndoSnapshot(source, dest, cards);
  state.moves += 1;
  if (!state.started) {
    state.started = true;
    startTimer();
  }
  selection = null;
  render();
  checkForWin();
}

function moveSelectionToTableau(destIndex, fromDrag = false) {
  if (state.won) return false;
  if (!selection) return false;
  if (selection.source.type === 'tableau' && selection.source.index === destIndex) {
    selection = null;
    render();
    return false;
  }
  const moving = peekSelectionCards(selection);
  if (moving.length === 0) return false;
  const destStack = state.tableau[destIndex];
  if (!canPlaceOnTableau(moving[0], destStack)) {
    if (!fromDrag) updateStatus('Invalid move.');
    return false;
  }
  if (selection.source.type !== 'tableau' && moving.length > 1) return false;
  if (selection.source.type === 'tableau' && !isValidTableauSequence(moving)) return false;

  const destIsEmpty = destStack.length === 0;
  if (options.allowSupermove && !options.disableSupermoveCap) {
    const maxMove = maxMovableToTableau({
      tableauPiles: state.tableau,
      freePiles: state.freecells,
      destIsEmptyTableau: destIsEmpty,
    });
    if (moving.length > maxMove) {
      const capType = destIsEmpty ? 'empty' : 'non-empty';
      updateStatus(`Blocked by supermove cap (${maxMove}) for ${capType}`, 'warning');
      return false;
    }
  }

  const sourceStack = getStack(selection.source);
  const removed = selection.source.type === 'tableau' ? sourceStack.splice(selection.cardIndex) : [sourceStack.pop()];
  applyMove(selection.source, { type: 'tableau', index: destIndex }, removed);
  return true;
}

function moveSelectionToFreecell(destIndex, fromDrag = false) {
  if (state.won) return false;
  if (!selection) return false;
  const destStack = state.freecells[destIndex];
  if (destStack.length !== 0) {
    if (!fromDrag) updateStatus('Free cell occupied.');
    return false;
  }
  const moving = peekSelectionCards(selection);
  if (moving.length !== 1) return false;
  if (selection.source.type === 'tableau' && !isTopCardInTableau(selection)) return false;

  const sourceStack = getStack(selection.source);
  const removed = selection.source.type === 'tableau' ? sourceStack.splice(selection.cardIndex) : [sourceStack.pop()];
  applyMove(selection.source, { type: 'freecell', index: destIndex }, removed);
  return true;
}

function moveSelectionToFoundation(destIndex, fromDrag = false) {
  if (state.won) return false;
  if (!selection) return false;
  const moving = peekSelectionCards(selection);
  if (moving.length !== 1) return false;
  if (selection.source.type === 'tableau' && !isTopCardInTableau(selection)) return false;
  const destStack = state.foundations[destIndex];
  if (!canPlaceOnFoundation(moving[0], destStack, destIndex)) {
    if (!fromDrag) updateStatus('Invalid foundation move.');
    return false;
  }

  const sourceStack = getStack(selection.source);
  const removed = selection.source.type === 'tableau' ? sourceStack.splice(selection.cardIndex) : [sourceStack.pop()];
  applyMove(selection.source, { type: 'foundation', index: destIndex }, removed);
  return true;
}

function moveSelectionToAutoFoundation() {
  if (!selection) return false;
  const moving = peekSelectionCards(selection);
  if (moving.length !== 1) return false;
  const destIndex = SUITS.indexOf(moving[0].suit);
  if (destIndex < 0) return false;
  return moveSelectionToFoundation(destIndex, true);
}

function undo() {
  if (state.won) return;
  const move = undoStack.pop();
  if (!move) return;
  const destStack = getStack(move.dest);
  destStack.splice(destStack.length - move.cards.length, move.cards.length);
  const sourceStack = getStack(move.source);
  sourceStack.push(...move.cards);
  state.moves = Math.max(0, state.moves - 1);
  selection = null;
  render();
}

function checkForWin() {
  const complete = state.foundations.every((stack) => stack.length === 13);
  if (!complete || state.won) return;
  state.won = true;
  stopTimer();
  selection = null;
  undoStack = [];
  recordGameEnd(true);
  updateStatus('You win! Click New Game to play again.');
  updateHud();
}

function buildCardElement(card, pileType, pileIndex, cardIndex) {
  const el = cardRenderer.createCardElement(card);
  el.dataset.pile = pileType;
  el.dataset.index = String(cardIndex);
  el.dataset.pileindex = String(pileIndex);

  if (selection) {
    const samePile = selection.source.type === pileType && selection.source.index === pileIndex;
    if (samePile) {
      if (pileType === 'tableau' && cardIndex >= selection.cardIndex) {
        el.classList.add('selected');
      }
      if (pileType !== 'tableau' && cardIndex === selection.cardIndex) {
        el.classList.add('selected');
      }
    }
  }

  return el;
}

function renderFreecells() {
  freecellsEl.innerHTML = '';
  for (let i = 0; i < FREECELL_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'pile freecell-slot';
    slot.dataset.pile = 'freecell';
    slot.dataset.index = String(i);
    const stack = state.freecells[i];
    if (stack.length === 0) {
      slot.classList.add('empty');
    } else {
      const card = stack[stack.length - 1];
      slot.appendChild(buildCardElement(card, 'freecell', i, 0));
    }
    freecellsEl.appendChild(slot);
  }
}

function renderFoundations() {
  foundationsEl.innerHTML = '';
  for (let i = 0; i < FOUNDATION_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'pile foundation-slot';
    slot.dataset.pile = 'foundation';
    slot.dataset.index = String(i);
    slot.dataset.suit = SUIT_SYMBOLS[SUITS[i]];
    const stack = state.foundations[i];
    if (stack.length === 0) {
      slot.classList.add('empty');
    } else {
      const card = stack[stack.length - 1];
      slot.appendChild(buildCardElement(card, 'foundation', i, stack.length - 1));
    }
    foundationsEl.appendChild(slot);
  }
}

function renderTableau() {
  tableauEl.innerHTML = '';
  const tableauTop = tableauEl.getBoundingClientRect().top;
  state.tableau.forEach((stack, colIdx) => {
    const spacing = tableauSpacingForStack(stack.length, tableauTop);
    const col = document.createElement('div');
    col.className = 'tableau-col';
    col.dataset.col = String(colIdx);
    stack.forEach((card, idx) => {
      const el = buildCardElement(card, 'tableau', colIdx, idx);
      el.style.top = `${idx * spacing}px`;
      col.appendChild(el);
    });
    tableauEl.appendChild(col);
  });
}

function render() {
  if (!state) return;
  renderFreecells();
  renderFoundations();
  renderTableau();
  updateHud();
  cleanupDanglingPreviews();
}

function cleanupDanglingPreviews() {
  const previews = document.querySelectorAll('.drag-preview');
  previews.forEach((el) => {
    if (dragState && dragState.preview === el) return;
    if (el.parentElement) el.parentElement.removeChild(el);
  });
}

function buildDragPreview(cards, pileType, startIndex, pileIndex) {
  const wrap = document.createElement('div');
  wrap.className = 'drag-preview';
  const spacing = dragState && typeof dragState.stackSpacing === 'number' ? dragState.stackSpacing : cardMetrics.spacing;
  cards.forEach((card, idx) => {
    const el = buildCardElement(card, pileType, pileIndex, startIndex + idx);
    el.style.position = 'absolute';
    el.style.top = `${idx * spacing}px`;
    wrap.appendChild(el);
  });
  document.body.appendChild(wrap);
  return wrap;
}

function updateDragPreviewPosition(clientX, clientY) {
  if (!dragState || !dragState.preview) return;
  const x = clientX - dragState.offsetX;
  const y = clientY - dragState.offsetY;
  dragState.preview.style.transform = `translate(${x}px, ${y}px)`;
}

function clearDragPreview() {
  if (dragState && dragState.preview && dragState.preview.parentElement) {
    dragState.preview.parentElement.removeChild(dragState.preview);
  }
  if (dragState) dragState.preview = null;
  clearDropIndicator();
  cleanupDanglingPreviews();
}

function clearDropIndicator() {
  if (!dropIndicator) return;
  dropIndicator.el.classList.remove(dropIndicator.className);
  dropIndicator = null;
}

function setDropIndicator(el, className) {
  if (!el || !className) {
    clearDropIndicator();
    return;
  }
  if (dropIndicator && dropIndicator.el === el && dropIndicator.className === className) return;
  clearDropIndicator();
  el.classList.add(className);
  dropIndicator = { el, className };
}

function evaluateTableauDrop(destIndex) {
  if (!selection) return { ok: false, reason: 'BUILD_RULE' };
  if (selection.source.type === 'tableau' && selection.source.index === destIndex) {
    return { ok: false, reason: 'BUILD_RULE' };
  }
  const moving = peekSelectionCards(selection);
  if (moving.length === 0) return { ok: false, reason: 'BUILD_RULE' };
  const destStack = state.tableau[destIndex];
  if (!canPlaceOnTableau(moving[0], destStack)) return { ok: false, reason: 'BUILD_RULE' };
  if (selection.source.type !== 'tableau' && moving.length > 1) return { ok: false, reason: 'BUILD_RULE' };
  if (selection.source.type === 'tableau' && !isValidTableauSequence(moving)) return { ok: false, reason: 'BUILD_RULE' };
  if (!options.allowSupermove && moving.length > 1) return { ok: false, reason: 'BUILD_RULE' };

  if (moving.length > 1 && options.allowSupermove && !options.disableSupermoveCap) {
    const destIsEmpty = destStack.length === 0;
    const maxMove = maxMovableToTableau({
      tableauPiles: state.tableau,
      freePiles: state.freecells,
      destIsEmptyTableau: destIsEmpty,
    });
    if (moving.length > maxMove) return { ok: false, reason: 'CAP' };
  }
  return { ok: true };
}

function evaluateFreecellDrop(destIndex) {
  if (!selection) return { ok: false, reason: 'BUILD_RULE' };
  if (selection.source.type === 'freecell' && selection.source.index === destIndex) {
    return { ok: false, reason: 'BUILD_RULE' };
  }
  const moving = peekSelectionCards(selection);
  if (moving.length !== 1) return { ok: false, reason: 'BUILD_RULE' };
  const destStack = state.freecells[destIndex];
  if (destStack.length !== 0) return { ok: false, reason: 'BUILD_RULE' };
  return { ok: true };
}

function evaluateFoundationDrop(destIndex) {
  if (!selection) return { ok: false, reason: 'BUILD_RULE' };
  if (selection.source.type === 'foundation' && selection.source.index === destIndex) {
    return { ok: false, reason: 'BUILD_RULE' };
  }
  const moving = peekSelectionCards(selection);
  if (moving.length !== 1) return { ok: false, reason: 'BUILD_RULE' };
  const destStack = state.foundations[destIndex];
  if (!canPlaceOnFoundation(moving[0], destStack, destIndex)) return { ok: false, reason: 'BUILD_RULE' };
  return { ok: true };
}

function dropIndicatorClass(result) {
  if (result.ok) return 'drop-ok';
  return result.reason === 'CAP' ? 'drop-cap' : 'drop-rule';
}

function updateDropIndicator(clientX, clientY) {
  if (!options.outlineValid) {
    clearDropIndicator();
    return;
  }
  if (!selection) {
    clearDropIndicator();
    return;
  }
  const target = document.elementFromPoint(clientX, clientY);
  if (!target) {
    clearDropIndicator();
    return;
  }
  const freecellSlot = target.closest('.freecell-slot');
  if (freecellSlot) {
    const idx = Number(freecellSlot.dataset.index);
    const highlightEl = freecellSlot.querySelector('.card') || freecellSlot;
    const result = evaluateFreecellDrop(idx);
    setDropIndicator(highlightEl, dropIndicatorClass(result));
    return;
  }
  const foundationSlot = target.closest('.foundation-slot');
  if (foundationSlot) {
    const idx = Number(foundationSlot.dataset.index);
    const highlightEl = foundationSlot.querySelector('.card') || foundationSlot;
    const result = evaluateFoundationDrop(idx);
    setDropIndicator(highlightEl, dropIndicatorClass(result));
    return;
  }
  const colEl = target.closest('.tableau-col');
  if (colEl) {
    const idx = Number(colEl.dataset.col);
    const highlightEl = colEl.querySelector('.card:last-child') || colEl;
    const result = evaluateTableauDrop(idx);
    setDropIndicator(highlightEl, dropIndicatorClass(result));
    return;
  }
  clearDropIndicator();
}

function selectionFromCardEl(cardEl) {
  const pileType = cardEl.dataset.pile;
  const pileIndex = Number(cardEl.dataset.pileindex ?? 0);
  const cardIndex = Number(cardEl.dataset.index ?? 0);
  if (pileType === 'tableau') {
    const stack = state.tableau[pileIndex];
    if (!stack || !stack[cardIndex]) return null;
    const sequence = stack.slice(cardIndex);
    if (!isValidTableauSequence(sequence)) return null;
    if (!options.allowSupermove && cardIndex !== stack.length - 1) return null;
    return { source: { type: 'tableau', index: pileIndex }, cardIndex };
  }
  if (pileType === 'freecell') {
    const stack = state.freecells[pileIndex];
    if (!stack.length) return null;
    return { source: { type: 'freecell', index: pileIndex }, cardIndex: 0 };
  }
  if (pileType === 'foundation') {
    const stack = state.foundations[pileIndex];
    if (!stack.length) return null;
    return { source: { type: 'foundation', index: pileIndex }, cardIndex: stack.length - 1 };
  }
  return null;
}

function isTopCard(sel) {
  if (!sel) return false;
  if (sel.source.type === 'tableau') return isTopCardInTableau(sel);
  return true;
}

function handleCardClick(sel, card) {
  const now = performance.now();
  if (now < ignoreClicksUntil) return;
  const isDouble = clickTracker.cardKey === card.id && now - clickTracker.time < 450;
  selection = sel;
  if (isDouble && options.autoFoundation && isTopCard(sel)) {
    moveSelectionToAutoFoundation();
    clickTracker = { cardKey: null, time: 0 };
    return;
  }
  clickTracker = { cardKey: card.id, time: now };
  render();
}

function handlePointerDown(ev) {
  if (state.won) return;
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
  if (!cardEl) return;
  const sel = selectionFromCardEl(cardEl);
  if (!sel) return;
  const rect = cardEl.getBoundingClientRect();
  selection = sel;
  dragState = {
    preview: null,
    offsetX: ev.clientX - rect.left,
    offsetY: ev.clientY - rect.top,
    startX: ev.clientX,
    startY: ev.clientY,
    dragging: false,
    stackSpacing: cardMetrics.spacing,
  };
  if (sel.source.type === 'tableau') {
    dragState.stackSpacing = tableauSpacingForStack(state.tableau[sel.source.index].length, tableauEl.getBoundingClientRect().top);
  }
}

function handlePointerMove(ev) {
  if (!dragState) return;
  const dist = Math.hypot(ev.clientX - dragState.startX, ev.clientY - dragState.startY);
  if (!dragState.dragging && dist < 4) return;
  if (!dragState.dragging) {
    const cards = peekSelectionCards(selection);
    if (cards.length === 0 || !selection) {
      dragState = null;
      return;
    }
    dragState.preview = buildDragPreview(cards, selection.source.type, selection.cardIndex, selection.source.index);
    dragState.dragging = true;
  }
  ev.preventDefault();
  updateDragPreviewPosition(ev.clientX, ev.clientY);
  updateDropIndicator(ev.clientX, ev.clientY);
}

function attemptDrop(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let handled = false;
  if (target) {
    const freecellSlot = target.closest('.freecell-slot');
    if (freecellSlot) {
      const idx = Number(freecellSlot.dataset.index);
      handled = moveSelectionToFreecell(idx, true);
    }
    if (!handled) {
      const foundationSlot = target.closest('.foundation-slot');
      if (foundationSlot) {
        const idx = Number(foundationSlot.dataset.index);
        handled = moveSelectionToFoundation(idx, true);
      }
    }
    if (!handled) {
      const colEl = target.closest('.tableau-col');
      if (colEl) {
        const idx = Number(colEl.dataset.col);
        handled = moveSelectionToTableau(idx, true);
      }
    }
  }
  if (!handled) {
    selection = null;
    render();
  }
  return handled;
}

function handlePointerUp(ev) {
  if (!dragState) return;
  if (dragState.dragging) {
    ev.preventDefault();
    attemptDrop(ev.clientX, ev.clientY);
    clearDragPreview();
    ignoreClicksUntil = performance.now() + 200;
  }
  dragState = null;
}

function handlePointerCancel() {
  clearDragPreview();
  dragState = null;
  selection = null;
  render();
}

function handleTableauClick(ev) {
  if (state.won) return;
  if (performance.now() < ignoreClicksUntil) return;
  const colEl = ev.target instanceof HTMLElement ? ev.target.closest('.tableau-col') : null;
  if (!colEl) return;
  const colIndex = Number(colEl.dataset.col);
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;

  if (selection && (!cardEl || selection.source.index !== colIndex || selection.source.type !== 'tableau')) {
    if (moveSelectionToTableau(colIndex)) return;
  }

  if (!cardEl) return;
  const cardIndex = Number(cardEl.dataset.index);
  const stack = state.tableau[colIndex];
  const card = stack[cardIndex];
  const sel = { source: { type: 'tableau', index: colIndex }, cardIndex };
  if (!isValidTableauSequence(stack.slice(cardIndex))) return;
  handleCardClick(sel, card);
}

function handleSlotClick(ev) {
  if (state.won) return;
  if (performance.now() < ignoreClicksUntil) return;
  const slotEl = ev.target instanceof HTMLElement ? ev.target.closest('.pile') : null;
  if (!slotEl) return;
  const pileType = slotEl.dataset.pile;
  const idx = Number(slotEl.dataset.index);

  if (selection) {
    if (pileType === 'freecell' && moveSelectionToFreecell(idx)) return;
    if (pileType === 'foundation' && moveSelectionToFoundation(idx)) return;
  }

  const cardEl = slotEl.querySelector('.card');
  if (!cardEl) return;
  const sel = selectionFromCardEl(cardEl);
  const cards = sel ? peekSelectionCards(sel) : [];
  if (sel && cards.length) {
    handleCardClick(sel, cards[0]);
  }
}

function attachEvents() {
  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);

  tableauEl.addEventListener('click', handleTableauClick);
  freecellsEl.addEventListener('click', handleSlotClick);
  foundationsEl.addEventListener('click', handleSlotClick);

  newBtn.addEventListener('click', () => newGame({ randomize: true }));
  selectGameBtn.addEventListener('click', () => {
    selectGameInput.value = String(currentDealNumber || 1);
    openModal(selectGameModal);
  });
  statsBtn.addEventListener('click', () => {
    updateStatsDisplay();
    openModal(statsModal);
  });
  undoBtn.addEventListener('click', () => undo());
  optionsBtn.addEventListener('click', () => openModal(optionsModal));

  selectGameOk.addEventListener('click', () => {
    const value = Number(selectGameInput.value);
    const safeNumber = Number.isFinite(value) ? Math.max(1, Math.min(DEAL_MAX, value)) : 1;
    closeModal(selectGameModal);
    options.dealMode = 'microsoft';
    applyOptions();
    newGame({ dealNumber: safeNumber });
  });
  selectGameCancel.addEventListener('click', () => closeModal(selectGameModal));

  statsCloseBtn.addEventListener('click', () => closeModal(statsModal));
  optionsCloseBtn.addEventListener('click', () => closeModal(optionsModal));
  optionsModal.addEventListener('click', (ev) => {
    if (ev.target === optionsModal) closeModal(optionsModal);
  });

  optDealMode.addEventListener('change', () => {
    options.dealMode = optDealMode.value === 'random' ? 'random' : 'microsoft';
    applyOptions();
    newGame();
  });
  optSupermove.addEventListener('change', () => {
    options.allowSupermove = optSupermove.checked;
    applyOptions();
  });
  optDisableCap.addEventListener('change', () => {
    options.disableSupermoveCap = optDisableCap.checked;
    applyOptions();
  });
  optAutoFoundation.addEventListener('change', () => {
    options.autoFoundation = optAutoFoundation.checked;
    applyOptions();
  });
  optOutlineValid.addEventListener('change', () => {
    options.outlineValid = optOutlineValid.checked;
    applyOptions();
  });
  optCardSize.addEventListener('change', () => {
    options.cardSize = optCardSize.value;
    applyOptions();
  });

  window.addEventListener('resize', () => render());

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closeModal(selectGameModal);
      closeModal(statsModal);
      closeModal(optionsModal);
    }
    if (ev.key === 'F2') {
      ev.preventDefault();
      newGame({ randomize: true });
    } else if (ev.key === 'F3') {
      ev.preventDefault();
      selectGameInput.value = String(currentDealNumber || 1);
      openModal(selectGameModal);
    } else if (ev.key === 'F4') {
      ev.preventDefault();
      updateStatsDisplay();
      openModal(statsModal);
    } else if (ev.key === 'F5') {
      ev.preventDefault();
      openModal(optionsModal);
    } else if (ev.key === 'F10') {
      ev.preventDefault();
      undo();
    }
  });
}

applyOptions();
attachEvents();
newGame({ randomize: true });
