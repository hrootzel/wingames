import { CardRenderer, SUITS } from './card_renderer.js';
import { CardLayout } from './card_layout.js';

const pyramidEl = document.getElementById('pyramid');
const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const statusEl = document.getElementById('status');
const settingsModal = document.getElementById('settings-modal');
const optShowHints = document.getElementById('opt-show-hints');

const cardRenderer = new CardRenderer();
const cardLayout = new CardLayout();

let state = null, undoSnapshot = null, selected = null, showHints = false;

const ROWS = 7;

function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let v = 1; v <= 13; v++) deck.push({ id: id++, suit, value: v, faceUp: true });
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
  const pyramid = [];
  for (let r = 0; r < ROWS; r++) {
    pyramid[r] = [];
    for (let c = 0; c <= r; c++) {
      pyramid[r].push(deck.pop());
    }
  }
  const wasteCard = deck.pop();
  return { pyramid, stock: deck, waste: [wasteCard], score: 0, moves: 0 };
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function newGame() {
  state = deal();
  undoSnapshot = null;
  selected = null;
  render();
  statusEl.textContent = 'Ready';
}

function getWasteTop() { return state.waste.length ? state.waste[state.waste.length - 1] : null; }

function isFree(r, c) {
  if (!state.pyramid[r][c]) return false;
  if (r === ROWS - 1) return true;
  return !state.pyramid[r + 1][c] && !state.pyramid[r + 1][c + 1];
}

function canPair(v1, v2) { return v1 + v2 === 13; }

function removePyramidCard(r, c) {
  const card = state.pyramid[r][c];
  state.pyramid[r][c] = null;
  return card;
}

function removeWasteTop() {
  return state.waste.pop();
}

function setUndo() { undoSnapshot = clone(state); }

function trySelect(loc) {
  const card = loc.type === 'pyramid' ? state.pyramid[loc.r][loc.c] : getWasteTop();
  if (!card) return;
  
  // King removes alone
  if (card.value === 13) {
    setUndo();
    if (loc.type === 'pyramid') removePyramidCard(loc.r, loc.c);
    else removeWasteTop();
    state.score += 13;
    state.moves++;
    selected = null;
    checkWin();
    render();
    statusEl.textContent = 'King removed!';
    return;
  }

  if (!selected) {
    selected = { ...loc, card };
    render();
    statusEl.textContent = `Selected ${card.value}. Pick another to sum to 13.`;
    return;
  }

  // Check if same card
  if (selected.type === loc.type && selected.r === loc.r && selected.c === loc.c) {
    selected = null;
    render();
    statusEl.textContent = 'Deselected.';
    return;
  }

  // Try to pair
  if (canPair(selected.card.value, card.value)) {
    setUndo();
    if (selected.type === 'pyramid') removePyramidCard(selected.r, selected.c);
    else removeWasteTop();
    if (loc.type === 'pyramid') removePyramidCard(loc.r, loc.c);
    else removeWasteTop();
    state.score += 13;
    state.moves++;
    selected = null;
    checkWin();
    render();
    statusEl.textContent = 'Pair removed!';
  } else {
    selected = { ...loc, card };
    render();
    statusEl.textContent = `Selected ${card.value}. Pick another to sum to 13.`;
  }
}

function flipStock() {
  if (!state.stock.length) {
    statusEl.textContent = 'Stock empty.';
    return;
  }
  setUndo();
  state.waste.push(state.stock.pop());
  state.moves++;
  selected = null;
  render();
  statusEl.textContent = 'Drew a card.';
}

function undo() {
  if (!undoSnapshot) return;
  state = clone(undoSnapshot);
  undoSnapshot = null;
  selected = null;
  render();
  statusEl.textContent = 'Undid last move.';
}

function pyramidEmpty() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      if (state.pyramid[r][c]) return false;
    }
  }
  return true;
}

function hasLegalMoves() {
  const free = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      if (state.pyramid[r][c] && isFree(r, c)) free.push(state.pyramid[r][c]);
    }
  }
  const wasteTop = getWasteTop();
  if (wasteTop) free.push(wasteTop);
  
  for (const card of free) {
    if (card.value === 13) return true;
  }
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (canPair(free[i].value, free[j].value)) return true;
    }
  }
  return state.stock.length > 0;
}

function checkWin() {
  if (pyramidEmpty()) {
    statusEl.textContent = '🎉 You cleared the pyramid!';
  } else if (!hasLegalMoves()) {
    statusEl.textContent = 'No moves left. Game over.';
  }
}

function render() {
  renderPyramid();
  renderStock();
  renderWaste();
  scoreEl.textContent = state.score;
  movesEl.textContent = state.moves;
  document.getElementById('undo').disabled = !undoSnapshot;
}

function createSlot(attrs) {
  const slot = document.createElement('div');
  slot.className = 'pyramid-slot';
  Object.entries(attrs).forEach(([k, v]) => slot.dataset[k] = v);
  return slot;
}

function isPlayable(card) {
  if (card.value === 13) return true;
  if (selected && canPair(selected.card.value, card.value)) return true;
  return false;
}

function renderPyramid() {
  pyramidEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      const slot = createSlot({ row: String(r), col: String(c) });
      const card = state.pyramid[r][c];
      if (card) {
        const free = isFree(r, c);
        const el = cardRenderer.getCardElement(card);
        cardRenderer.resetCardInlineStyles(el);
        el.dataset.locType = 'pyramid';
        el.dataset.r = r;
        el.dataset.c = c;
        if (free) {
          const isSelected = selected && selected.type === 'pyramid' && selected.r === r && selected.c === c;
          el.classList.toggle('selected', isSelected);
          el.classList.toggle('playable', showHints && !isSelected && isPlayable(card));
          el.style.pointerEvents = 'auto';
        } else {
          el.style.pointerEvents = 'none';
        }
        slot.appendChild(el);
      }
      pyramidEl.appendChild(slot);
    }
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
    const isSelected = selected && selected.type === 'waste';
    el.classList.toggle('selected', isSelected);
    el.classList.toggle('playable', showHints && !isSelected && isPlayable(top));
    el.dataset.locType = 'waste';
    wasteEl.appendChild(el);
  }
}

pyramidEl.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl || cardEl.dataset.locType !== 'pyramid') return;
  const r = +cardEl.dataset.r, c = +cardEl.dataset.c;
  if (!isFree(r, c)) return;
  trySelect({ type: 'pyramid', r, c });
});

wasteEl.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;
  trySelect({ type: 'waste' });
});

stockEl.addEventListener('click', flipStock);
document.getElementById('flip-stock').addEventListener('click', flipStock);
document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('undo').addEventListener('click', undo);

document.getElementById('settings-toggle').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('settings-apply').addEventListener('click', () => settingsModal.classList.add('hidden'));
optShowHints.addEventListener('change', () => { showHints = optShowHints.checked; render(); });

cardLayout.init({ constraints: [{ columns: 7, element: pyramidEl }], observeElements: [pyramidEl], onUpdate: () => state && render() });
newGame();
