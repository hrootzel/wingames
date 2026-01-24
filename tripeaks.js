import { CardRenderer, SUITS } from './card_renderer.js';
import { CardLayout } from './card_layout.js';

const peaksEl = document.getElementById('peaks');
const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const statusEl = document.getElementById('status');
const settingsModal = document.getElementById('settings-modal');
const optShowHints = document.getElementById('opt-show-hints');

const cardRenderer = new CardRenderer();
const cardLayout = new CardLayout();

let state = null, undoSnapshot = null;
let showHints = false;

const BASE_COUNT = 10;

function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let v = 1; v <= 13; v++) deck.push({ id: id++, suit, value: v, faceUp: false });
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function deal() {
  const deck = createDeck();
  shuffle(deck);
  const peaks = [[], [], []];
  for (let p = 0; p < 3; p++) {
    for (let r = 0; r < 3; r++) {
      peaks[p][r] = [];
      for (let c = 0; c <= r; c++) {
        const card = deck.pop();
        card.faceUp = false;
        peaks[p][r].push(card);
      }
    }
  }
  const base = [];
  for (let i = 0; i < BASE_COUNT; i++) {
    const card = deck.pop();
    card.faceUp = true;
    base.push(card);
  }
  const wasteCard = deck.pop();
  wasteCard.faceUp = true;
  return { peaks, base, stock: deck, waste: [wasteCard], score: 0, moves: 0, streak: 0 };
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function newGame() {
  state = deal();
  undoSnapshot = null;
  render();
  statusEl.textContent = 'Ready';
}

function getWasteTop() { return state.waste[state.waste.length - 1] || null; }

function isAdjacent(a, b) {
  if (Math.abs(a - b) === 1) return true;
  return (a === 1 && b === 13) || (a === 13 && b === 1);
}

// A card is free if both cards below it (in the next row) are removed
function isFree(loc) {
  if (loc.type === 'base') {
    return !!state.base[loc.idx];
  }
  const { p, r, c } = loc;
  if (!state.peaks[p][r][c]) return false;
  if (r === 2) {
    // Row 2 cards are free if both base cards below them are gone
    // Peak p row 2 col c sits above base indices: p*3+c and p*3+c+1
    const b1 = p * 3 + c, b2 = p * 3 + c + 1;
    return !state.base[b1] && !state.base[b2];
  }
  // Rows 0-1: free if both children in row below are gone
  const below = state.peaks[p][r + 1];
  return !below[c] && !below[c + 1];
}

function updateFaceUp() {
  for (let p = 0; p < 3; p++) {
    for (let r = 2; r >= 0; r--) {
      for (let c = 0; c <= r; c++) {
        const card = state.peaks[p][r][c];
        if (card && !card.faceUp && isFree({ type: 'peak', p, r, c })) {
          card.faceUp = true;
        }
      }
    }
  }
}

function canPlay(card) {
  const top = getWasteTop();
  return top && isAdjacent(card.value, top.value);
}

function allLocations() {
  const locs = [];
  for (let p = 0; p < 3; p++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c <= r; c++) {
        if (state.peaks[p][r][c]) locs.push({ type: 'peak', p, r, c });
      }
    }
  }
  for (let i = 0; i < BASE_COUNT; i++) {
    if (state.base[i]) locs.push({ type: 'base', idx: i });
  }
  return locs;
}

function getCard(loc) {
  if (loc.type === 'base') return state.base[loc.idx];
  return state.peaks[loc.p][loc.r][loc.c];
}

function removeCard(loc) {
  if (loc.type === 'base') { const c = state.base[loc.idx]; state.base[loc.idx] = null; return c; }
  const c = state.peaks[loc.p][loc.r][loc.c];
  state.peaks[loc.p][loc.r][loc.c] = null;
  return c;
}

function playCard(loc) {
  const card = getCard(loc);
  if (!card || !card.faceUp || !canPlay(card)) return false;
  undoSnapshot = clone(state);
  removeCard(loc);
  card.faceUp = true;
  state.waste.push(card);
  state.streak++;
  state.score += state.streak;
  state.moves++;
  updateFaceUp();
  checkWin();
  render();
  return true;
}

function flipStock() {
  if (!state.stock.length) { statusEl.textContent = 'Stock empty.'; return; }
  undoSnapshot = clone(state);
  const card = state.stock.pop();
  card.faceUp = true;
  state.waste.push(card);
  state.streak = 0;
  state.moves++;
  render();
  statusEl.textContent = hasLegalMoves() ? 'Flipped stock.' : 'No moves left.';
}

function undo() {
  if (!undoSnapshot) return;
  state = clone(undoSnapshot);
  undoSnapshot = null;
  render();
  statusEl.textContent = 'Undid last move.';
}

function hasLegalMoves() {
  return allLocations().some(loc => {
    const card = getCard(loc);
    return card && card.faceUp && canPlay(card);
  });
}

function checkWin() {
  const remaining = allLocations().length;
  if (remaining === 0) {
    statusEl.textContent = '🎉 You cleared all peaks!';
    state.score += state.stock.length * 10;
    render();
  } else if (!hasLegalMoves() && !state.stock.length) {
    statusEl.textContent = 'No moves left. Game over.';
  } else {
    statusEl.textContent = `Streak: ${state.streak}`;
  }
}

function render() {
  renderPeaks();
  renderStock();
  renderWaste();
  scoreEl.textContent = state.score;
  movesEl.textContent = state.moves;
  document.getElementById('undo').disabled = !undoSnapshot;
}

function createSlot(attrs) {
  const slot = document.createElement('div');
  slot.className = 'tripeaks-slot';
  Object.entries(attrs).forEach(([k, v]) => slot.dataset[k] = v);
  return slot;
}

function renderPeaks() {
  peaksEl.innerHTML = '';
  
  // Row 0: peak tops
  for (let p = 0; p < 3; p++) {
    const slot = createSlot({ row: '0', peak: String(p) });
    const card = state.peaks[p][0][0];
    if (card) {
      const playable = card.faceUp && canPlay(card);
      const el = cardRenderer.getCardElement(card);
      cardRenderer.resetCardInlineStyles(el);
      el.classList.toggle('playable', showHints && playable);
      el.dataset.locType = 'peak'; el.dataset.p = p; el.dataset.r = 0; el.dataset.c = 0;
      slot.appendChild(el);
    }
    peaksEl.appendChild(slot);
  }

  // Row 1
  for (let p = 0; p < 3; p++) {
    for (let c = 0; c < 2; c++) {
      const slot = createSlot({ row: '1', peak: String(p), col: String(c) });
      const card = state.peaks[p][1][c];
      if (card) {
        const playable = card.faceUp && canPlay(card);
        const el = cardRenderer.getCardElement(card);
        cardRenderer.resetCardInlineStyles(el);
        el.classList.toggle('playable', showHints && playable);
        el.dataset.locType = 'peak'; el.dataset.p = p; el.dataset.r = 1; el.dataset.c = c;
        slot.appendChild(el);
      }
      peaksEl.appendChild(slot);
    }
  }

  // Row 2
  for (let p = 0; p < 3; p++) {
    for (let c = 0; c < 3; c++) {
      const slot = createSlot({ row: '2', peak: String(p), col: String(c) });
      const card = state.peaks[p][2][c];
      if (card) {
        const playable = card.faceUp && canPlay(card);
        const el = cardRenderer.getCardElement(card);
        cardRenderer.resetCardInlineStyles(el);
        el.classList.toggle('playable', showHints && playable);
        el.dataset.locType = 'peak'; el.dataset.p = p; el.dataset.r = 2; el.dataset.c = c;
        slot.appendChild(el);
      }
      peaksEl.appendChild(slot);
    }
  }

  // Base row
  for (let i = 0; i < BASE_COUNT; i++) {
    const slot = createSlot({ row: '3', col: String(i) });
    const card = state.base[i];
    if (card) {
      const playable = canPlay(card);
      const el = cardRenderer.getCardElement(card);
      cardRenderer.resetCardInlineStyles(el);
      el.classList.toggle('playable', showHints && playable);
      el.dataset.locType = 'base'; el.dataset.idx = i;
      slot.appendChild(el);
    }
    peaksEl.appendChild(slot);
  }
}

function renderStock() {
  stockEl.innerHTML = '';
  const back = document.createElement('div');
  back.className = 'card-back';
  if (!state.stock.length) back.classList.add('empty');
  stockEl.appendChild(back);
  const count = document.createElement('div');
  count.className = 'stock-count';
  count.textContent = state.stock.length;
  stockEl.appendChild(count);
}

function renderWaste() {
  wasteEl.innerHTML = '';
  const top = getWasteTop();
  if (top) {
    const el = cardRenderer.getCardElement(top);
    cardRenderer.resetCardInlineStyles(el);
    wasteEl.appendChild(el);
  }
}

peaksEl.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;
  const locType = cardEl.dataset.locType;
  let loc;
  if (locType === 'peak') loc = { type: 'peak', p: +cardEl.dataset.p, r: +cardEl.dataset.r, c: +cardEl.dataset.c };
  else if (locType === 'base') loc = { type: 'base', idx: +cardEl.dataset.idx };
  else return;
  if (!playCard(loc)) statusEl.textContent = 'Not a valid move.';
});

stockEl.addEventListener('click', flipStock);
document.getElementById('flip-stock').addEventListener('click', flipStock);
document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('undo').addEventListener('click', undo);

// Settings
document.getElementById('settings-toggle').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('settings-apply').addEventListener('click', () => settingsModal.classList.add('hidden'));
optShowHints.addEventListener('change', () => { showHints = optShowHints.checked; render(); });

cardLayout.init({ constraints: [{ columns: 10, element: peaksEl }], observeElements: [peaksEl], onUpdate: () => state && render() });
newGame();
