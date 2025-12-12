/**
 * Unicode Solitaire (Klondike) in TypeScript.
 * Rules are modeled after the classic Windows/ReactOS solitaire: draw 1/3 toggle,
 * standard or Vegas scoring, single-step undo, auto-move to foundations.
 */

type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
type ScoreMode = 'none' | 'standard' | 'vegas';
type Pile = 'stock' | 'waste' | 'tableau' | 'foundation';

interface Card {
  id: number;
  suit: Suit;
  value: number;
  faceUp: boolean;
}

interface GameOptions {
  drawCount: 1 | 3;
  scoreMode: ScoreMode;
  keepVegas: boolean;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  score: number;
  wasteRedeals: number;
  started: boolean;
  timeSeconds: number;
  lastMoveSource?: Pile;
}

interface Selection {
  source: Pile;
  pileIndex: number;
  cardIndex: number;
}

interface UndoSnapshot {
  state: GameState;
}

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣️', diamonds: '♦️', hearts: '♥️', spades: '♠️' };
const VALUE_LABELS: Record<number, string> = {
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

let options: GameOptions = { drawCount: 3, scoreMode: 'standard', keepVegas: false };
let state: GameState;
let selection: Selection | null = null;
let undoSnapshot: UndoSnapshot | null = null;
let timerId: number | null = null;
let vegasBank = -52;
let lastMode: ScoreMode = 'standard';

const stockEl = document.getElementById('stock') as HTMLElement;
const wasteEl = document.getElementById('waste') as HTMLElement;
const foundationEls = Array.from(document.querySelectorAll('.foundation')) as HTMLElement[];
const tableauEl = document.getElementById('tableau') as HTMLElement;
const scoreEl = document.getElementById('score') as HTMLElement;
const timeEl = document.getElementById('time') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const undoBtn = document.getElementById('undo') as HTMLButtonElement;
const newBtn = document.getElementById('new-game') as HTMLButtonElement;
const autoBtn = document.getElementById('auto-move') as HTMLButtonElement;
const drawSelect = document.getElementById('draw-mode') as HTMLSelectElement;
const scoreSelect = document.getElementById('score-mode') as HTMLSelectElement;
const keepVegasCheckbox = document.getElementById('keep-vegas') as HTMLInputElement;

function cardColor(suit: Suit): 'red' | 'black' {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ id: id++, suit, value, faceUp: false });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function initialScore(): number {
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

function cloneCard(card: Card): Card {
  return { ...card };
}

function cloneState(current: GameState): GameState {
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

function setUndoSnapshot(): void {
  undoSnapshot = { state: cloneState(state) };
  undoBtn.disabled = false;
}

function clearUndo(): void {
  undoSnapshot = null;
  undoBtn.disabled = true;
}

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function startTimer(): void {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    if (!state.started) return;
    state.timeSeconds += 1;
    if (options.scoreMode === 'standard' && state.timeSeconds % 10 === 0) {
      state.score = Math.max(0, state.score - 2);
    }
    updateVegasBank();
    updateStatus();
  }, 1000);
}

function updateVegasBank(): void {
  if (options.scoreMode === 'vegas') {
    vegasBank = state.score;
  }
}

function newGame(): void {
  const deck = createDeck();
  shuffle(deck);

  const tableau: Card[][] = [];
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

function getFoundationIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function formatCardLabel(card: Card): string {
  return `${VALUE_LABELS[card.value]}${SUIT_SYMBOLS[card.suit]}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function canMoveToFoundation(card: Card, stack: Card[]): boolean {
  if (stack.length === 0) {
    return card.value === 1;
  }
  const top = stack[stack.length - 1];
  return top.suit === card.suit && card.value === top.value + 1;
}

function canMoveToTableau(card: Card, stack: Card[]): boolean {
  if (stack.length === 0) {
    return card.value === 13;
  }
  const top = stack[stack.length - 1];
  const differentColor = cardColor(card.suit) !== cardColor(top.suit);
  return differentColor && card.value === top.value - 1;
}

function getRedealThreshold(): number {
  if (options.scoreMode === 'vegas') {
    return options.drawCount === 3 ? 2 : 0;
  }
  if (options.scoreMode === 'standard') {
    return options.drawCount === 3 ? 3 : 0;
  }
  return Number.POSITIVE_INFINITY;
}

function handleStockClick(): void {
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

function drawFromStock(): void {
  const draw = Math.min(options.drawCount, state.stock.length);
  const drawn = state.stock.splice(state.stock.length - draw, draw);
  drawn.forEach((card) => (card.faceUp = true));
  state.waste.push(...drawn);
  state.lastMoveSource = 'stock';
}

function handleRedeal(): void {
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

function takeSelectedCards(): Card[] {
  if (!selection) return [];
  let cards: Card[] = [];
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

function peekSelectedCards(): Card[] {
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

function flipTopIfNeeded(origin: Selection): void {
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

function applyTableauScoring(origin: Selection): void {
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

function applyFoundationScoring(origin: Selection): void {
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

function moveSelectionToTableau(targetIndex: number): boolean {
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

function moveSelectionToFoundation(targetIndex?: number): boolean {
  if (!selection) return false;
  if (selection.source === 'foundation') return false;
  const moving = peekSelectedCards();
  if (moving.length !== 1) return false;

  const destIndex = targetIndex ?? getFoundationIndex(moving[0].suit);
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

function autoMoveOnce(): boolean {
  const wasteTop = state.waste[state.waste.length - 1];
  if (wasteTop) {
    const idx = getFoundationIndex(wasteTop.suit);
    if (canMoveToFoundation(wasteTop, state.foundations[idx])) {
      state.foundations[idx].push(state.waste.pop() as Card);
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
        state.foundations[idx].push(col.pop() as Card);
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

function autoMoveAll(): void {
  let moved = false;
  do {
    moved = autoMoveOnce();
  } while (moved);
  if (state.started) {
    startTimer();
  }
}

function undo(): void {
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

function resetSelection(): void {
  selection = null;
}

function checkForWin(): void {
  const complete = state.foundations.every((stack) => stack.length === 13);
  if (complete) {
    state.started = false;
    stopTimer();
    window.setTimeout(() => {
      alert(`You win! Score: ${state.score} Time: ${formatTime(state.timeSeconds)}`);
    }, 50);
  }
}

function updateStatus(): void {
  scoreEl.textContent = options.scoreMode === 'none' ? '—' : state.score.toString();
  timeEl.textContent = formatTime(state.timeSeconds);
  const drawLabel = options.drawCount === 1 ? 'Draw 1' : 'Draw 3';
  const modeLabel = options.scoreMode === 'none' ? 'No score' : options.scoreMode === 'standard' ? 'Standard score' : 'Vegas score';
  statusEl.textContent = `${drawLabel} · ${modeLabel}`;
  undoBtn.disabled = undoSnapshot === null;
}

function updateControls(): void {
  drawSelect.value = options.drawCount.toString();
  scoreSelect.value = options.scoreMode;
  keepVegasCheckbox.checked = options.keepVegas;
}

function renderStock(): void {
  stockEl.innerHTML = '';
  const pile = document.createElement('div');
  pile.className = 'card-back';
  if (state.stock.length === 0) {
    pile.classList.add('empty');
  }
  stockEl.appendChild(pile);
}

function buildCardElement(card: Card, pileType: Pile, cardIndex: number, pileIndex?: number): HTMLElement {
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

  el.textContent = formatCardLabel(card);
  if (cardColor(card.suit) === 'red') {
    el.classList.add('red');
  }

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

function renderWaste(): void {
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

function renderFoundations(): void {
  foundationEls.forEach((container, idx) => {
    container.innerHTML = '';
    const stack = state.foundations[idx];
    container.classList.toggle('empty', stack.length === 0);
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];
    const el = buildCardElement(top, 'foundation', stack.length - 1, idx);
    container.appendChild(el);
  });
}

function renderTableau(): void {
  tableauEl.innerHTML = '';
  state.tableau.forEach((stack, colIdx) => {
    const col = document.createElement('div');
    col.className = 'tableau-col';
    col.dataset.col = colIdx.toString();
    col.style.minHeight = '160px';

    stack.forEach((card, idx) => {
      const el = buildCardElement(card, 'tableau', idx, colIdx);
      el.style.top = `${idx * TABLEAU_SPACING}px`;
      col.appendChild(el);
    });

    tableauEl.appendChild(col);
  });
}

function render(): void {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  updateStatus();
}

function attachEvents(): void {
  stockEl.addEventListener('click', () => {
    handleStockClick();
  });

  wasteEl.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!target) return;
    const idx = state.waste.length - 1;
    if (idx < 0) return;
    selection = { source: 'waste', pileIndex: 0, cardIndex: idx };
    render();
  });

  wasteEl.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    if (state.waste.length === 0) return;
    selection = { source: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 };
    moveSelectionToFoundation();
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
    const cardEl = (ev.target as HTMLElement).closest('.card') as HTMLElement | null;
    const colEl = (ev.target as HTMLElement).closest('.tableau-col') as HTMLElement | null;
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

    selection = { source: 'tableau', pileIndex: colIndex, cardIndex };
    render();
  });

  tableauEl.addEventListener('dblclick', (ev) => {
    const cardEl = (ev.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!cardEl) return;
    const colEl = (ev.target as HTMLElement).closest('.tableau-col') as HTMLElement | null;
    if (!colEl) return;
    const colIndex = Number(colEl.dataset.col);
    const cardIndex = Number(cardEl.dataset.index);
    const stack = state.tableau[colIndex];
    if (cardIndex !== stack.length - 1) return;
    if (!stack[cardIndex].faceUp) return;

    selection = { source: 'tableau', pileIndex: colIndex, cardIndex };
    moveSelectionToFoundation();
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
    const drawValue = Number(drawSelect.value) as 1 | 3;
    options = { ...options, drawCount: drawValue };
    newGame();
  });

  scoreSelect.addEventListener('change', () => {
    const mode = scoreSelect.value as ScoreMode;
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

