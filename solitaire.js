/**
 * Unicode Solitaire (Klondike) compiled to plain JS for the browser.
 * Mirrors the logic in solitaire.ts.
 */

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = { clubs: '\u2663\uFE0F', diamonds: '\u2666\uFE0F', hearts: '\u2665\uFE0F', spades: '\u2660\uFE0F' };
const VALUE_LABELS = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

const TABLEAU_SPACING = 26;
const WASTE_SPACING = 16;
const CARD_HEIGHT = 120;
const VIEWPORT_BOTTOM_MARGIN = 28;
const MIN_TABLEAU_SPACING = 12;
const TIGHTEN_START = 10;
const TIGHTEN_END = 24;

function tableauSpacingForStack(stackLength, tableauTop) {
  if (stackLength <= 1) return TABLEAU_SPACING;
  const availableHeight = Math.max(0, window.innerHeight - tableauTop - VIEWPORT_BOTTOM_MARGIN);
  const fitSpacing = (availableHeight - CARD_HEIGHT) / (stackLength - 1);

  const t = stackLength <= TIGHTEN_START ? 0 : Math.min(1, (stackLength - TIGHTEN_START) / (TIGHTEN_END - TIGHTEN_START));
  const desiredSpacing = TABLEAU_SPACING - t * (TABLEAU_SPACING - MIN_TABLEAU_SPACING);

  return Math.max(0, Math.min(TABLEAU_SPACING, desiredSpacing, fitSpacing));
}

let options = { drawCount: 3, scoreMode: 'standard', keepVegas: false };
let state;
let selection = null;
let undoSnapshot = null;
let timerId = null;
let vegasBank = -52;
let lastMode = 'standard';
let clickTracker = { cardKey: null, time: 0 };
let ignoreClicksUntil = 0;

const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const foundationEls = Array.from(document.querySelectorAll('.foundation'));
const tableauEl = document.getElementById('tableau');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo');
const newBtn = document.getElementById('new-game');
const autoBtn = document.getElementById('auto-move');
const drawSelect = document.getElementById('draw-mode');
const scoreSelect = document.getElementById('score-mode');
const keepVegasCheckbox = document.getElementById('keep-vegas');
let dragState = null;

function cleanupDanglingPreviews() {
  const previews = document.querySelectorAll('.drag-preview');
  previews.forEach((el) => {
    if (dragState && dragState.preview === el) return;
    if (el.parentElement) el.parentElement.removeChild(el);
  });
}

function cardColor(suit) {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ id: id++, suit, value, faceUp: false });
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

function initialScore() {
  if (options.scoreMode === 'vegas') {
    if (options.keepVegas && lastMode === 'vegas') {
      vegasBank -= 52;
    } else {
      vegasBank = -52;
    }
    return vegasBank;
  }
  return 0;
}

function cloneCard(card) {
  return { ...card };
}

function cloneState(current) {
  return {
    stock: current.stock.map(cloneCard),
    waste: current.waste.map(cloneCard),
    foundations: current.foundations.map((stack) => stack.map(cloneCard)),
    tableau: current.tableau.map((stack) => stack.map(cloneCard)),
    score: current.score,
    wasteRedeals: current.wasteRedeals,
    started: current.started,
    timeSeconds: current.timeSeconds,
    lastMoveSource: current.lastMoveSource,
  };
}

function setUndoSnapshot() {
  undoSnapshot = { state: cloneState(state) };
  undoBtn.disabled = false;
}

function clearUndo() {
  undoSnapshot = null;
  undoBtn.disabled = true;
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
    if (!state.started) return;
    state.timeSeconds += 1;
    if (options.scoreMode === 'standard' && state.timeSeconds % 10 === 0) {
      state.score = Math.max(0, state.score - 2);
    }
    updateVegasBank();
    updateStatus();
  }, 1000);
}

function updateVegasBank() {
  if (options.scoreMode === 'vegas') {
    vegasBank = state.score;
  }
}

function newGame() {
  cleanupDanglingPreviews();
  dragState = null;
  const deck = createDeck();
  shuffle(deck);

  const tableau = [];
  for (let col = 0; col < 7; col++) {
    const stack = deck.splice(0, col + 1);
    stack.forEach((card, idx) => {
      card.faceUp = idx === stack.length - 1;
    });
    tableau.push(stack);
  }

  state = {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    score: initialScore(),
    wasteRedeals: 0,
    started: false,
    timeSeconds: 0,
    lastMoveSource: undefined,
  };
  lastMode = options.scoreMode;
  selection = null;
  clearUndo();
  stopTimer();
  updateControls();
  render();
}

function getFoundationIndex(suit) {
  return SUITS.indexOf(suit);
}

function formatCardLabel(card) {
  return `${VALUE_LABELS[card.value]}${SUIT_SYMBOLS[card.suit]}`;
}

function pipLayout(value) {
  // Default positions mapped to a 3x7 grid (indices 0..20)
  const defaults = {
    1: [10],
    2: [1, 19],
    3: [1, 10, 19],
    4: [0, 2, 18, 20],
    5: [0, 2, 10, 18, 20],
    6: [0, 2, 9, 11, 18, 20],
    7: [0, 2, 3, 5, 6, 8, 4], // compact 3x4 grid indices (shifted via CSS)
    8: [0, 2, 3, 5, 6, 8, 9, 11], // compact 3x4 grid indices
  };
  if (value === 9) {
    // 3x4 grid (indices 0..11): 8 on sides + 1 center
    return [0, 2, 3, 5, 6, 8, 9, 11, 4];
  }
  if (value === 10) {
    // 3x4 grid: 8 on sides + 2 centers
    return [0, 2, 3, 5, 6, 8, 9, 11, 4, 7];
  }
  return defaults[value] || [];
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function canMoveToFoundation(card, stack) {
  if (stack.length === 0) {
    return card.value === 1;
  }
  const top = stack[stack.length - 1];
  return top.suit === card.suit && card.value === top.value + 1;
}

function canMoveToTableau(card, stack) {
  if (stack.length === 0) {
    return card.value === 13;
  }
  const top = stack[stack.length - 1];
  const differentColor = cardColor(card.suit) !== cardColor(top.suit);
  return differentColor && card.value === top.value - 1;
}

function getRedealThreshold() {
  if (options.scoreMode === 'vegas') {
    return options.drawCount === 3 ? 2 : 0;
  }
  if (options.scoreMode === 'standard') {
    return options.drawCount === 3 ? 3 : 0;
  }
  return Number.POSITIVE_INFINITY;
}

function handleStockClick() {
  if (state.stock.length === 0) {
    handleRedeal();
    return;
  }
  setUndoSnapshot();
  drawFromStock();
  state.started = true;
  startTimer();
  render();
}

function drawFromStock() {
  const draw = Math.min(options.drawCount, state.stock.length);
  const drawn = state.stock.splice(state.stock.length - draw, draw);
  drawn.forEach((card) => (card.faceUp = true));
  state.waste.push(...drawn);
  state.lastMoveSource = 'stock';
}

function handleRedeal() {
  if (state.waste.length === 0) return;

  const threshold = getRedealThreshold();
  if (options.scoreMode === 'vegas' && state.wasteRedeals >= threshold) {
    statusEl.textContent = 'No more redeals in Vegas mode.';
    return;
  }

  setUndoSnapshot();
  const cards = [...state.waste].reverse();
  cards.forEach((card) => (card.faceUp = false));
  state.stock = cards;
  state.waste = [];
  state.wasteRedeals += 1;

  if (options.scoreMode === 'standard' && threshold !== Number.POSITIVE_INFINITY && state.wasteRedeals > threshold) {
    state.score = Math.max(0, state.score - (options.drawCount === 3 ? 20 : 100));
    updateVegasBank();
  }
  state.lastMoveSource = 'stock';
  render();
}

function takeSelectedCards() {
  if (!selection) return [];
  let cards = [];
  if (selection.source === 'tableau') {
    cards = state.tableau[selection.pileIndex].splice(selection.cardIndex);
  } else if (selection.source === 'waste') {
    const card = state.waste.pop();
    if (card) cards = [card];
  } else if (selection.source === 'foundation') {
    const card = state.foundations[selection.pileIndex].pop();
    if (card) cards = [card];
  }
  return cards;
}

function peekSelectedCards() {
  if (!selection) return [];
  if (selection.source === 'tableau') {
    return state.tableau[selection.pileIndex].slice(selection.cardIndex);
  }
  if (selection.source === 'waste') {
    const card = state.waste[state.waste.length - 1];
    return card ? [card] : [];
  }
  if (selection.source === 'foundation') {
    const card = state.foundations[selection.pileIndex][state.foundations[selection.pileIndex].length - 1];
    return card ? [card] : [];
  }
  return [];
}

function flipTopIfNeeded(origin) {
  if (origin.source === 'tableau') {
    const stack = state.tableau[origin.pileIndex];
    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top.faceUp) {
        top.faceUp = true;
        if (options.scoreMode === 'standard') {
          state.score += 5;
          updateVegasBank();
        }
      }
    }
  }
}

function applyTableauScoring(origin) {
  if (options.scoreMode === 'none') return;
  if (origin.source === 'waste' && options.scoreMode === 'standard') {
    state.score += 5;
  } else if (origin.source === 'foundation') {
    if (options.scoreMode === 'standard') {
      state.score = Math.max(0, state.score - 15);
    } else if (options.scoreMode === 'vegas') {
      state.score = Math.max(-52, state.score - 5);
    }
  }
  updateVegasBank();
}

function applyFoundationScoring(origin) {
  if (options.scoreMode === 'none') return;
  if (origin.source === 'waste' || origin.source === 'tableau') {
    if (options.scoreMode === 'standard') {
      state.score += 10;
    } else if (options.scoreMode === 'vegas') {
      state.score += 5;
    }
  }
  updateVegasBank();
}

function moveSelectionToTableau(targetIndex) {
  if (!selection) return false;
  if (selection.source === 'tableau' && selection.pileIndex === targetIndex) {
    selection = null;
    render();
    return false;
  }
  const moving = peekSelectedCards();
  if (moving.length === 0) return false;
  const targetStack = state.tableau[targetIndex];
  if (!canMoveToTableau(moving[0], targetStack)) return false;

  setUndoSnapshot();
  const moved = takeSelectedCards();
  targetStack.push(...moved);
  applyTableauScoring(selection);
  flipTopIfNeeded(selection);
  selection = null;
  state.started = true;
  startTimer();
  render();
  return true;
}

function moveSelectionToFoundation(targetIndex) {
  if (!selection) return false;
  if (selection.source === 'foundation') return false;
  const moving = peekSelectedCards();
  if (moving.length !== 1) return false;

  const destIndex = targetIndex !== undefined ? targetIndex : getFoundationIndex(moving[0].suit);
  const stack = state.foundations[destIndex];
  if (!canMoveToFoundation(moving[0], stack)) return false;
  if (selection.source === 'tableau') {
    const sourceStack = state.tableau[selection.pileIndex];
    if (selection.cardIndex !== sourceStack.length - 1) return false;
  }

  setUndoSnapshot();
  const card = takeSelectedCards()[0];
  stack.push(card);
  applyFoundationScoring(selection);
  flipTopIfNeeded(selection);
  selection = null;
  state.started = true;
  startTimer();
  render();
  checkForWin();
  return true;
}

function autoMoveOnce() {
  const wasteTop = state.waste[state.waste.length - 1];
  if (wasteTop) {
    const idx = getFoundationIndex(wasteTop.suit);
    if (canMoveToFoundation(wasteTop, state.foundations[idx])) {
      state.foundations[idx].push(state.waste.pop());
      applyFoundationScoring({ source: 'waste', pileIndex: 0, cardIndex: 0 });
      render();
      checkForWin();
      return true;
    }
  }

  for (let i = 0; i < state.tableau.length; i++) {
    const col = state.tableau[i];
    const top = col[col.length - 1];
    if (top && top.faceUp) {
      const idx = getFoundationIndex(top.suit);
      if (canMoveToFoundation(top, state.foundations[idx])) {
        state.foundations[idx].push(col.pop());
        applyFoundationScoring({ source: 'tableau', pileIndex: i, cardIndex: col.length });
        flipTopIfNeeded({ source: 'tableau', pileIndex: i, cardIndex: col.length });
        render();
        checkForWin();
        return true;
      }
    }
  }
  return false;
}

function autoMoveAll() {
  let moved = false;
  do {
    moved = autoMoveOnce();
  } while (moved);
  if (state.started) {
    startTimer();
  }
}

function undo() {
  if (!undoSnapshot) return;
  state = cloneState(undoSnapshot.state);
  selection = null;
  undoSnapshot = null;
  undoBtn.disabled = true;
  if (!state.started) {
    stopTimer();
  } else {
    startTimer();
  }
  render();
}

function resetSelection() {
  selection = null;
}

function checkForWin() {
  const complete = state.foundations.every((stack) => stack.length === 13);
  if (complete) {
    state.started = false;
    stopTimer();
    setTimeout(() => {
      alert(`You win! Score: ${state.score} Time: ${formatTime(state.timeSeconds)}`);
    }, 50);
  }
}

function updateStatus() {
  scoreEl.textContent = options.scoreMode === 'none' ? '—' : state.score.toString();
  timeEl.textContent = formatTime(state.timeSeconds);
  const drawLabel = options.drawCount === 1 ? 'Draw 1' : 'Draw 3';
  const modeLabel = options.scoreMode === 'none' ? 'No score' : options.scoreMode === 'standard' ? 'Standard score' : 'Vegas score';
  statusEl.textContent = `${drawLabel} · ${modeLabel}`;
  undoBtn.disabled = undoSnapshot === null;
}

function updateControls() {
  drawSelect.value = options.drawCount.toString();
  scoreSelect.value = options.scoreMode;
  keepVegasCheckbox.checked = options.keepVegas;
}

function renderStock() {
  stockEl.innerHTML = '';
  const pile = document.createElement('div');
  pile.className = 'card-back';
  if (state.stock.length === 0) {
    pile.classList.add('empty');
  }
  stockEl.appendChild(pile);
}

function buildCardElement(card, pileType, cardIndex, pileIndex) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.pile = pileType;
  el.dataset.index = cardIndex.toString();
  if (pileIndex !== undefined) {
    el.dataset.pileindex = pileIndex.toString();
    el.dataset.col = pileIndex.toString();
  }

  if (!card.faceUp) {
    el.classList.add('face-down');
    return el;
  }

  if (cardColor(card.suit) === 'red') {
    el.classList.add('red');
  }

  const content = document.createElement('div');
  content.className = 'card-content';

  const cornerTop = document.createElement('div');
  cornerTop.className = 'corner top';
  cornerTop.textContent = formatCardLabel(card);
  content.appendChild(cornerTop);

  const cornerBottom = document.createElement('div');
  cornerBottom.className = 'corner bottom';
  cornerBottom.textContent = formatCardLabel(card);
  content.appendChild(cornerBottom);

  if (card.value >= 11) {
    const face = document.createElement('div');
    face.className = 'face-label';
    face.textContent = VALUE_LABELS[card.value];
    content.appendChild(face);
  } else {
    const pips = document.createElement('div');
    pips.className = 'pips';
    if (card.value >= 7) {
      pips.classList.add('pips-tight');
    }
    if (card.value >= 7) {
      pips.classList.add('pips-compact-4');
    }
    if (card.value === 7) {
      pips.classList.add('pips-seven');
    }
    pipLayout(card.value).forEach((cell) => {
      const pip = document.createElement('div');
      pip.className = 'pip';
      if (card.value >= 9 && card.value <= 10) {
        pip.classList.add('pip-xsmall');
      } else if (card.value >= 5 && card.value <= 8) {
        pip.classList.add('pip-small');
      }
      const row = Math.floor(cell / 3) + 1;
      const col = (cell % 3) + 1;
      pip.style.gridRow = String(row);
      pip.style.gridColumn = String(col);
      pip.textContent = SUIT_SYMBOLS[card.suit];
      pips.appendChild(pip);
    });
    content.appendChild(pips);
  }

  el.appendChild(content);

  if (selection) {
    const selectedPileMatches = selection.source === pileType && selection.pileIndex === (pileIndex ?? 0);
    if (selectedPileMatches) {
      if (pileType === 'tableau' && cardIndex >= selection.cardIndex) {
        el.classList.add('selected');
      }
      if ((pileType === 'waste' || pileType === 'foundation') && cardIndex === selection.cardIndex) {
        el.classList.add('selected');
      }
    }
  }

  return el;
}

function buildDragPreview(cards, source, startIndex, pileIndex) {
  const wrap = document.createElement('div');
  wrap.className = 'drag-preview';
  const spacing = dragState && typeof dragState.stackSpacing === 'number' ? dragState.stackSpacing : TABLEAU_SPACING;
  cards.forEach((card, idx) => {
    const el = buildCardElement(card, source, startIndex + idx, pileIndex);
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
  if (dragState) {
    dragState.preview = null;
  }
  cleanupDanglingPreviews();
}

function attemptDrop(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let handled = false;
  if (target) {
    const foundation = target.closest('.foundation');
    if (foundation) {
      const idx = Number(foundation.dataset.index ?? foundation.dataset.pileindex ?? 0);
      handled = moveSelectionToFoundation(idx);
    }
    if (!handled) {
      const colEl = target.closest('.tableau-col');
      if (colEl) {
        const idx = Number(colEl.dataset.col ?? 0);
        handled = moveSelectionToTableau(idx);
      }
    }
  }
  if (!handled) {
    selection = null;
    render();
  }
}

function handlePointerDown(ev) {
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
  };
  if (selection.source === 'tableau') {
    dragState.stackSpacing = tableauSpacingForStack(state.tableau[selection.pileIndex].length, tableauEl.getBoundingClientRect().top);
  } else {
    dragState.stackSpacing = TABLEAU_SPACING;
  }
}

function handlePointerMove(ev) {
  if (!dragState) return;
  const dist = Math.hypot(ev.clientX - dragState.startX, ev.clientY - dragState.startY);
  if (!dragState.dragging && dist < 4) return;
  if (!dragState.dragging) {
    const cards = peekSelectedCards();
    if (cards.length === 0 || !selection) {
      dragState = null;
      return;
    }
    dragState.preview = buildDragPreview(cards, selection.source, selection.cardIndex, selection.pileIndex);
    dragState.dragging = true;
  }
  ev.preventDefault();
  updateDragPreviewPosition(ev.clientX, ev.clientY);
}

function handlePointerUp(ev) {
  if (!dragState) return;
  if (dragState.dragging) {
    ev.preventDefault();
    attemptDrop(ev.clientX, ev.clientY);
    clearDragPreview();
    ignoreClicksUntil = performance.now() + 200;
  } else {
    // Not a drag; let the click tracker consider this click
  }
  dragState = null;
}

function handlePointerCancel() {
  clearDragPreview();
  dragState = null;
  selection = null;
  render();
}

function selectionFromCardEl(cardEl) {
  const pileType = cardEl.dataset.pile;
  if (!pileType)
    return null;
  const pileIndex = Number(cardEl.dataset.pileindex ?? cardEl.dataset.col ?? 0);
  const cardIndex = Number(cardEl.dataset.index ?? 0);
  if (pileType === 'tableau') {
    const stack = state.tableau[pileIndex];
    if (!stack || !stack[cardIndex] || !stack[cardIndex].faceUp) return null;
    return { source: 'tableau', pileIndex, cardIndex };
  }
  if (pileType === 'waste') {
    if (state.waste.length === 0) return null;
    return { source: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 };
  }
  if (pileType === 'foundation') {
    const stack = state.foundations[pileIndex];
    if (!stack || stack.length === 0) return null;
    return { source: 'foundation', pileIndex, cardIndex: stack.length - 1 };
  }
  return null;
}

function isTopFaceUp(sel) {
  if (!sel)
    return false;
  if (sel.source === 'tableau') {
    const stack = state.tableau[sel.pileIndex];
    if (!stack || stack.length === 0)
      return false;
    if (sel.cardIndex !== stack.length - 1)
      return false;
    return !!stack[sel.cardIndex].faceUp;
  }
  if (sel.source === 'waste') {
    if (sel.cardIndex !== state.waste.length - 1)
      return false;
    const card = state.waste[sel.cardIndex];
    return !!card && !!card.faceUp;
  }
  return false;
}

function handleCardClick(sel, card) {
  const now = performance.now();
  if (now < ignoreClicksUntil) {
    return;
  }
  const isDouble = clickTracker.cardKey === card.id && now - clickTracker.time < 450;
  selection = sel;
  if (isDouble && isTopFaceUp(sel)) {
    moveSelectionToFoundation();
    clickTracker = { cardKey: null, time: 0 };
    return;
  }
  clickTracker = { cardKey: card.id, time: now };
  render();
}

function renderWaste() {
  wasteEl.innerHTML = '';
  const visible = options.drawCount === 3 ? Math.min(3, state.waste.length) : Math.min(1, state.waste.length);
  const start = state.waste.length - visible;
  for (let i = 0; i < visible; i++) {
    const card = state.waste[start + i];
    const el = buildCardElement(card, 'waste', start + i);
    el.style.left = `${i * WASTE_SPACING}px`;
    el.style.zIndex = `${i}`;
    wasteEl.appendChild(el);
  }
}

function renderFoundations() {
  foundationEls.forEach((container, idx) => {
    container.innerHTML = '';
    container.dataset.index = idx.toString();
    const stack = state.foundations[idx];
    container.classList.toggle('empty', stack.length === 0);
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];
    const el = buildCardElement(top, 'foundation', stack.length - 1, idx);
    container.appendChild(el);
  });
}

function renderTableau() {
  tableauEl.innerHTML = '';
  const tableauTop = tableauEl.getBoundingClientRect().top;
  state.tableau.forEach((stack, colIdx) => {
    const spacing = tableauSpacingForStack(stack.length, tableauTop);
    const col = document.createElement('div');
    col.className = 'tableau-col';
    col.dataset.col = colIdx.toString();
    col.style.minHeight = '160px';

    stack.forEach((card, idx) => {
      const el = buildCardElement(card, 'tableau', idx, colIdx);
      el.style.top = `${idx * spacing}px`;
      col.appendChild(el);
    });

    tableauEl.appendChild(col);
  });
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  updateStatus();
  cleanupDanglingPreviews();
}

function attachEvents() {
  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);

  window.addEventListener('resize', () => {
    if (!state) return;
    render();
  });

  stockEl.addEventListener('click', () => {
    handleStockClick();
  });

  wasteEl.addEventListener('click', (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
    if (!target) return;
    const idx = state.waste.length - 1;
    if (idx < 0) return;
    const card = state.waste[idx];
    const sel = { source: 'waste', pileIndex: 0, cardIndex: idx };
    handleCardClick(sel, card);
  });

  foundationEls.forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (state.foundations[idx].length === 0) {
        if (selection) {
          moveSelectionToFoundation(idx);
        }
        return;
      }
      const topIndex = state.foundations[idx].length - 1;
      selection = { source: 'foundation', pileIndex: idx, cardIndex: topIndex };
      render();
    });
  });

  tableauEl.addEventListener('click', (ev) => {
    const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
    const colEl = ev.target instanceof HTMLElement ? ev.target.closest('.tableau-col') : null;
    if (!colEl) return;
    const colIndex = Number(colEl.dataset.col);

    if (!cardEl) {
      if (selection) {
        moveSelectionToTableau(colIndex);
      }
      return;
    }

    const cardIndex = Number(cardEl.dataset.index);
    const stack = state.tableau[colIndex];
    const card = stack[cardIndex];
    if (!card.faceUp) {
      resetSelection();
      render();
      return;
    }

    const sel = { source: 'tableau', pileIndex: colIndex, cardIndex };
    handleCardClick(sel, card);
  });

  undoBtn.addEventListener('click', () => undo());
  newBtn.addEventListener('click', () => {
    newGame();
  });
  autoBtn.addEventListener('click', () => {
    setUndoSnapshot();
    autoMoveAll();
    state.started = true;
    render();
  });

  drawSelect.addEventListener('change', () => {
    const drawValue = Number(drawSelect.value);
    options = { ...options, drawCount: drawValue };
    newGame();
  });

  scoreSelect.addEventListener('change', () => {
    const mode = scoreSelect.value;
    options = { ...options, scoreMode: mode };
    newGame();
  });

  keepVegasCheckbox.addEventListener('change', () => {
    options = { ...options, keepVegas: keepVegasCheckbox.checked };
    newGame();
  });
}

attachEvents();
newGame();
startTimer();
