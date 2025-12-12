// Spider Solitaire in plain JS, reusing the card rendering styles from solitaire.
// Click or drag suited descending runs; deal adds one card to each column.

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = { clubs: '\u2663\uFE0F', diamonds: '\u2666\uFE0F', hearts: '\u2665\uFE0F', spades: '\u2660\uFE0F' };
const VALUE_LABELS = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K'
};

const TABLEAU_SPACING = 22;

const stockEl = document.getElementById('stock');
const tableauEl = document.getElementById('tableau');
const completedEl = document.getElementById('completed');
const dealsEl = document.getElementById('deals');
const statusEl = document.getElementById('status');
const newBtn = document.getElementById('new-game');
const dealBtn = document.getElementById('deal');
const difficultySelect = document.getElementById('difficulty');

let state;
let selection = null;
let dragState = null;
let ignoreClicksUntil = 0;

function cardColor(suit) {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

function createDeck(difficulty) {
  const suitsUsed = difficulty === 1 ? ['spades'] : (difficulty === 2 ? ['spades', 'hearts'] : SUITS);
  const deck = [];
  let id = 0;
  for (let set = 0; set < 8; set++) {
    const suit = suitsUsed[set % suitsUsed.length];
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

function pipLayout(value) {
  const defaults = {
    1: [10],
    2: [1, 19],
    3: [1, 10, 19],
    4: [0, 2, 18, 20],
    5: [0, 2, 10, 18, 20],
    6: [0, 2, 9, 11, 18, 20],
    7: [0, 2, 3, 5, 6, 8, 4], // compact 3x4 grid indices
    8: [0, 2, 3, 5, 6, 8, 9, 11], // compact 3x4 grid indices
  };
  if (value === 9) {
    return [0, 2, 3, 5, 6, 8, 9, 11, 4];
  }
  if (value === 10) {
    return [0, 2, 3, 5, 6, 8, 9, 11, 4, 7];
  }
  return defaults[value] || [];
}

function formatCardLabel(card) {
  return `${VALUE_LABELS[card.value]}${SUIT_SYMBOLS[card.suit]}`;
}

function dealInitial(difficulty) {
  const deck = createDeck(difficulty);
  shuffle(deck);
  const tableau = Array.from({ length: 10 }, () => []);
  let covered = 5; // first four get 6 cards
  for (let col = 0; col < 10; col++) {
    if (col === 4) covered = 4;
    for (let i = 0; i <= covered; i++) {
      const card = deck.pop();
      if (i === covered) card.faceUp = true;
      tableau[col].push(card);
    }
  }
  const stock = deck; // remaining face-down
  return { tableau, stock };
}

function newGame() {
  selection = null;
  dragState = null;
  const difficulty = Number(difficultySelect.value);
  const { tableau, stock } = dealInitial(difficulty);
  state = {
    tableau,
    stock,
    difficulty,
    completed: 0,
  };
  updateStatus('Ready');
  render();
}

function updateStatus(text) {
  statusEl.textContent = text;
  completedEl.textContent = String(state.completed);
  dealsEl.textContent = String(Math.floor(state.stock.length / 10));
}

function formatPipElement(card, cell) {
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
  return pip;
}

function buildCardElement(card, colIndex, cardIndex) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.pile = 'tableau';
  el.dataset.pileindex = String(colIndex);
  el.dataset.index = String(cardIndex);

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
      pips.classList.add('pips-tight', 'pips-compact-4');
    }
    pipLayout(card.value).forEach((cell) => {
      pips.appendChild(formatPipElement(card, cell));
    });
    content.appendChild(pips);
  }

  el.appendChild(content);

  if (selection && selection.col === colIndex && cardIndex >= selection.index) {
    el.classList.add('selected');
  }

  return el;
}

function render() {
  // stock
  stockEl.innerHTML = '';
  const back = document.createElement('div');
  back.className = 'card-back';
  if (state.stock.length === 0) back.classList.add('empty');
  stockEl.appendChild(back);

  // tableau
  tableauEl.innerHTML = '';
  state.tableau.forEach((stack, colIdx) => {
    const col = document.createElement('div');
    col.className = 'tableau-col';
    col.dataset.col = String(colIdx);
    stack.forEach((card, idx) => {
      const el = buildCardElement(card, colIdx, idx);
      el.style.top = `${idx * TABLEAU_SPACING}px`;
      col.appendChild(el);
    });
    tableauEl.appendChild(col);
  });

  completedEl.textContent = String(state.completed);
  dealsEl.textContent = String(Math.floor(state.stock.length / 10));
}

function canDragFrom(colIdx, cardIdx) {
  const stack = state.tableau[colIdx];
  if (!stack[cardIdx] || !stack[cardIdx].faceUp) return false;
  for (let i = cardIdx; i < stack.length - 1; i++) {
    const a = stack[i];
    const b = stack[i + 1];
    if (!(a.value === b.value + 1 && a.suit === b.suit)) return false;
  }
  return true;
}

function canDropOn(targetStack, movingBottom) {
  if (targetStack.length === 0) return true;
  const top = targetStack[targetStack.length - 1];
  return top.value === movingBottom.value + 1;
}

function moveSelectionTo(colIdx) {
  if (!selection) return false;
  const { col, index } = selection;
  if (col === colIdx) {
    selection = null;
    render();
    return false;
  }
  const fromStack = state.tableau[col];
  const moving = fromStack.slice(index);
  if (moving.length === 0) return false;
  if (!canDropOn(state.tableau[colIdx], moving[0])) return false;

  state.tableau[col] = fromStack.slice(0, index);
  state.tableau[colIdx] = state.tableau[colIdx].concat(moving);

  const newTop = state.tableau[col][state.tableau[col].length - 1];
  if (newTop) newTop.faceUp = true;

  selection = null;
  const removed = checkCompletedRuns(colIdx);
  if (removed) {
    updateStatus(state.completed === 8 ? 'You win!' : 'Completed a run!');
  }
  render();
  if (!removed) {
    updateStatus('Moved');
  }
  return true;
}

function checkCompletedRuns(colIdx) {
  const stack = state.tableau[colIdx];
  let run = 1;
  for (let i = stack.length - 1; i > 0; i--) {
    const cur = stack[i];
    const prev = stack[i - 1];
    if (prev.value === cur.value + 1 && prev.suit === cur.suit) {
      run += 1;
      if (run === 13) {
        // remove run
        state.tableau[colIdx] = stack.slice(0, i - 1);
        state.completed += 1;
        const newTop = state.tableau[colIdx][state.tableau[colIdx].length - 1];
        if (newTop) newTop.faceUp = true;
        return true;
      }
    } else {
      run = 1;
    }
  }
  return false;
}

function dealFromStock() {
  if (state.stock.length === 0) {
    updateStatus('No more deals.');
    return;
  }
  if (state.tableau.some((col) => col.length === 0)) {
    updateStatus('Cannot deal: empty column present.');
    return;
  }
  for (let i = 0; i < 10; i++) {
    const card = state.stock.pop();
    if (!card) break;
    card.faceUp = true;
    state.tableau[i].push(card);
  }
  updateStatus('Dealt one card to each column.');
  render();
}

function handlePointerDown(ev) {
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
  if (!cardEl) return;
  const col = Number(cardEl.dataset.pileindex || cardEl.dataset.col);
  const idx = Number(cardEl.dataset.index);
  if (!canDragFrom(col, idx)) return;
  const rect = cardEl.getBoundingClientRect();
  selection = { col, index: idx };
  dragState = {
    preview: null,
    offsetX: ev.clientX - rect.left,
    offsetY: ev.clientY - rect.top,
    startX: ev.clientX,
    startY: ev.clientY,
    dragging: false,
  };
  render();
}

function buildDragPreview(cards, colIdx, startIndex) {
  const wrap = document.createElement('div');
  wrap.className = 'drag-preview';
  cards.forEach((card, idx) => {
    const el = buildCardElement(card, colIdx, startIndex + idx);
    el.style.position = 'absolute';
    el.style.top = `${idx * TABLEAU_SPACING}px`;
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
}

function attemptDrop(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let handled = false;
  if (target) {
    const colEl = target.closest('.tableau-col');
    if (colEl) {
      const colIdx = Number(colEl.dataset.col);
      handled = moveSelectionTo(colIdx);
    }
  }
  if (!handled) {
    selection = null;
    render();
  }
}

function handlePointerMove(ev) {
  if (!dragState) return;
  const dist = Math.hypot(ev.clientX - dragState.startX, ev.clientY - dragState.startY);
  if (!dragState.dragging && dist < 4) return;
  if (!dragState.dragging) {
    const fromStack = state.tableau[selection.col];
    const cards = fromStack.slice(selection.index);
    dragState.preview = buildDragPreview(cards, selection.col, selection.index);
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
  if (performance.now() < ignoreClicksUntil) return;
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
  const colEl = ev.target instanceof HTMLElement ? ev.target.closest('.tableau-col') : null;
  if (!colEl) return;
  const colIndex = Number(colEl.dataset.col);
  if (!cardEl) {
    if (selection) moveSelectionTo(colIndex);
    return;
  }
  const cardIndex = Number(cardEl.dataset.index);
  if (!canDragFrom(colIndex, cardIndex)) {
    selection = null;
    render();
    return;
  }
  selection = { col: colIndex, index: cardIndex };
  render();
}

function attachEvents() {
  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);

  tableauEl.addEventListener('click', handleTableauClick);

  stockEl.addEventListener('click', () => {
    dealFromStock();
  });

  newBtn.addEventListener('click', () => newGame());
  dealBtn.addEventListener('click', () => dealFromStock());
  difficultySelect.addEventListener('change', () => newGame());
}

attachEvents();
newGame();

