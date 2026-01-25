import { CardRenderer, SUITS } from './card_renderer.js';
import { CardLayout } from './card_layout.js';

const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const movesEl = document.getElementById('moves');
const pairsEl = document.getElementById('pairs');
const totalPairsEl = document.getElementById('total-pairs');
const timeEl = document.getElementById('time');
const newBtn = document.getElementById('new-game');
const gridSizeSelect = document.getElementById('grid-size');

const cardRenderer = new CardRenderer();
const cardLayout = new CardLayout();

let state = null;
let flipped = [];
let locked = false;
let timer = null;
let startTime = null;

function createDeck(pairCount) {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ id: id++, suit, value, faceUp: true });
    }
  }
  shuffle(deck);
  return deck.slice(0, pairCount);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function newGame() {
  const totalCards = parseInt(gridSizeSelect.value);
  const pairCount = totalCards / 2;
  const cards = createDeck(pairCount);
  
  // Create pairs with unique IDs
  const deck = [];
  let uniqueId = 0;
  cards.forEach((card, idx) => {
    deck.push({ ...card, id: uniqueId++, pairId: idx, slotId: deck.length });
    deck.push({ ...card, id: uniqueId++, pairId: idx, slotId: deck.length });
  });
  
  shuffle(deck);
  
  state = {
    cards: deck,
    flipped: [],
    matched: new Set(),
    moves: 0,
    pairs: 0,
    totalPairs: pairCount,
    started: false,
  };
  
  flipped = [];
  locked = false;
  startTime = null;
  if (timer) clearInterval(timer);
  timer = null;
  
  updateGrid();
  updateHud();
  statusEl.textContent = 'Click any card to start.';
}

function updateGrid() {
  const cols = state.cards.length === 12 ? 4 : 4;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--card-width))`;
  gridEl.innerHTML = '';
  
  state.cards.forEach((card, idx) => {
    const slot = document.createElement('div');
    slot.className = 'memory-slot';
    slot.dataset.idx = idx;
    
    const isMatched = state.matched.has(card.pairId);
    const isFlipped = state.flipped.includes(idx) || isMatched;
    
    if (isMatched) {
      slot.classList.add('matched');
    }
    
    if (isFlipped) {
      slot.classList.add('flipped');
    }
    
    // Card back
    const back = document.createElement('div');
    back.className = 'card-back';
    slot.appendChild(back);
    
    // Card face
    const cardEl = cardRenderer.getCardElement(card);
    cardRenderer.resetCardInlineStyles(cardEl);
    slot.appendChild(cardEl);
    
    gridEl.appendChild(slot);
  });
}

function updateHud() {
  movesEl.textContent = state.moves;
  pairsEl.textContent = state.pairs;
  totalPairsEl.textContent = state.totalPairs;
  
  if (startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  } else {
    timeEl.textContent = '0:00';
  }
}

function startTimer() {
  if (timer) return;
  startTime = Date.now();
  timer = setInterval(updateHud, 1000);
}

function flipCard(idx) {
  if (locked) return;
  if (state.flipped.includes(idx)) return;
  if (state.matched.has(state.cards[idx].pairId)) return;
  
  if (!state.started) {
    state.started = true;
    startTimer();
  }
  
  state.flipped.push(idx);
  flipped.push(idx);
  updateGrid();
  
  if (flipped.length === 2) {
    locked = true;
    state.moves++;
    updateHud();
    
    const [idx1, idx2] = flipped;
    const card1 = state.cards[idx1];
    const card2 = state.cards[idx2];
    
    if (card1.pairId === card2.pairId) {
      // Match!
      setTimeout(() => {
        state.matched.add(card1.pairId);
        state.pairs++;
        state.flipped = state.flipped.filter(i => i !== idx1 && i !== idx2);
        flipped = [];
        locked = false;
        updateGrid();
        updateHud();
        checkWin();
      }, 600);
    } else {
      // No match
      setTimeout(() => {
        state.flipped = state.flipped.filter(i => i !== idx1 && i !== idx2);
        flipped = [];
        locked = false;
        updateGrid();
      }, 1000);
    }
  }
}

function checkWin() {
  if (state.pairs === state.totalPairs) {
    if (timer) clearInterval(timer);
    statusEl.textContent = `🎉 You won in ${state.moves} moves!`;
  }
}

gridEl.addEventListener('click', (e) => {
  const slot = e.target.closest('.memory-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.idx);
  flipCard(idx);
});

newBtn.addEventListener('click', newGame);
gridSizeSelect.addEventListener('change', newGame);

cardLayout.init({
  constraints: [{ columns: 4, element: gridEl }],
  observeElements: [gridEl],
  onUpdate: () => state && updateGrid(),
});

newGame();
