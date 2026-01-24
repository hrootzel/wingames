// Spider Solitaire in plain JS, reusing the card rendering styles from solitaire.
// Click or drag suited descending runs; deal adds one card to each column.

import { SfxEngine } from './sfx_engine.js';
import { BANK_SPIDER } from './card_sfx_banks.js';
import { CardRenderer, SUITS } from './card_renderer.js';
import { CardLayout, calcStackSpacing, createDragPreviewCache, hideDragPreview } from './card_layout.js';

const sfx = new SfxEngine({ master: 0.6 });
const cardRenderer = new CardRenderer();
let audioUnlocked = false;

const tableauEl = document.getElementById('tableau');
const cardLayout = new CardLayout();

function getStackSpacing(stackLength) {
  const m = cardLayout.metrics;
  return calcStackSpacing({
    stackLength,
    containerTop: tableauEl?.getBoundingClientRect().top ?? 0,
    cardHeight: m.cardHeight,
    baseSpacing: m.stackSpacing,
    minSpacing: 8,
    tightenStart: 14,
    tightenEnd: 42,
  });
}

const stockEl = document.getElementById('stock');
const completedAcesEl = document.getElementById('completed-aces');
const completedEl = document.getElementById('completed');
const dealsEl = document.getElementById('deals');
const statusEl = document.getElementById('status');
const newBtn = document.getElementById('new-game');
const dealBtn = document.getElementById('deal');
const undoBtn = document.getElementById('undo');
const difficultySelect = document.getElementById('difficulty');

let state;
let selection = null;
let dragState = null;
const dragPreviewCache = createDragPreviewCache();
let ignoreClicksUntil = 0;
let undoSnapshot = null;
let winFx = null;

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateUndoButton() {
  if (!undoBtn) return;
  undoBtn.disabled = !undoSnapshot;
}

function pushUndo() {
  undoSnapshot = cloneState(state);
  updateUndoButton();
}

function undo() {
  if (!undoSnapshot) return;
  unlockAudio();
  sfx.play(BANK_SPIDER, 'undo');
  stopWinCelebration();
  clearDragPreview();
  dragState = null;
  selection = null;
  state = undoSnapshot;
  undoSnapshot = null;
  render();
  updateStatus('Undid.');
  updateUndoButton();
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
  stopWinCelebration();
  selection = null;
  dragState = null;
  undoSnapshot = null;
  updateUndoButton();
  const difficulty = Number(difficultySelect.value);
  const { tableau, stock } = dealInitial(difficulty);
  state = {
    tableau,
    stock,
    difficulty,
    completed: 0,
    completedRuns: [],
    completedCards: [],
    won: false,
  };
  updateStatus('Ready');
  render();
}

function updateStatus(text) {
  statusEl.textContent = text;
  completedEl.textContent = String(state.completed);
  dealsEl.textContent = String(Math.floor(state.stock.length / 10));
  checkForWin();
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function checkForWin() {
  if (!state || state.won) return;
  if (state.completed !== 8) return;
  state.won = true;
  undoSnapshot = null;
  updateUndoButton();
  statusEl.textContent = 'You win!';
  sfx.play(BANK_SPIDER, 'win');
  startWinCelebration();
}

function stopWinCelebration() {
  if (!winFx) return;
  winFx.running = false;
  if (winFx.rafId) cancelAnimationFrame(winFx.rafId);
  if (winFx.spawnTimer) clearTimeout(winFx.spawnTimer);
  if (winFx.overlay && winFx.overlay.parentElement) {
    winFx.overlay.parentElement.removeChild(winFx.overlay);
  }
  winFx = null;
}

function startWinCelebration() {
  stopWinCelebration();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'win-overlay';
  const msg = document.createElement('div');
  msg.className = 'win-message';
  msg.textContent = 'You win! (Click New Game to restart)';
  overlay.appendChild(msg);
  document.body.appendChild(overlay);

  const originEl = completedAcesEl || stockEl;
  const originRect = originEl ? originEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: 20, width: 0, height: 0 };

  const pending = (state.completedCards && state.completedCards.length ? state.completedCards : state.completedRuns || []).slice();
  const particles = [];

  const fx = { overlay, particles, pending, running: true, rafId: 0, spawnTimer: 0, lastTime: performance.now() };
  winFx = fx;

  function spawnOne() {
    if (!fx.running) return;
    const next = fx.pending.pop();
    if (!next) return;
    const card = typeof next === 'string' ? { suit: next, value: 1, faceUp: true } : { suit: next.suit, value: next.value, faceUp: true };

    const el = buildCardVisual(card);
    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '0px';
    overlay.appendChild(el);

    const startX = originRect.left + Math.random() * Math.max(0, originRect.width - cardLayout.metrics.cardWidth);
    const startY = originRect.top + Math.random() * Math.max(0, originRect.height - cardLayout.metrics.cardHeight);
    const vx = (Math.random() * 2 - 1) * 720;
    const vy = -(650 + Math.random() * 900);
    const rot = (Math.random() * 2 - 1) * 35;
    const vr = (Math.random() * 2 - 1) * 420;

    particles.push({ el, x: startX, y: startY, vx, vy, rot, vr, resting: false });
    el.style.transform = `translate(${startX}px, ${startY}px) rotate(${rot}deg)`;

    fx.spawnTimer = setTimeout(spawnOne, 35);
  }

  function step(now) {
    if (!fx.running) return;
    const dt = Math.min(0.05, (now - fx.lastTime) / 1000);
    fx.lastTime = now;

    const gravity = 2600;
    const wallBounce = 0.86;
    const floorBounce = 0.78;
    const maxY = window.innerHeight - cardLayout.metrics.cardHeight;
    const airDrag = 0.18;
    const groundDrag = 2.4;
    const groundFriction = 0.9;
    const restVy = 110;
    const restVx = 6;
    const airFactor = Math.exp(-airDrag * dt);
    const groundFactor = Math.exp(-groundDrag * dt);

    let anyMoving = fx.pending.length > 0;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (!p.resting) {
        p.vy += gravity * dt;
      } else {
        p.vy = 0;
        p.y = maxY;
        p.vx *= groundFactor;
        p.vr *= groundFactor;
        if (Math.abs(p.vx) < restVx) p.vx = 0;
        if (Math.abs(p.vr) < 3) p.vr = 0;
      }

      p.vx *= airFactor;
      p.vr *= airFactor;

      p.x += p.vx * dt;
      if (!p.resting) {
        p.y += p.vy * dt;
      }
      p.rot += p.vr * dt;

      if (p.x + cardLayout.metrics.cardWidth < 0 || p.x > window.innerWidth) {
        p.el.remove();
        particles.splice(i, 1);
        continue;
      }

      if (p.y < 0) {
        p.y = 0;
        p.vy = -p.vy * wallBounce;
      } else if (p.y > maxY) {
        p.y = maxY;
        p.vy = -p.vy * floorBounce;
        p.vx *= groundFriction;
        p.vr *= groundFriction;
        if (Math.abs(p.vy) < restVy) {
          p.vy = 0;
          p.resting = true;
        }
      }

      if (!p.resting || Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5 || Math.abs(p.vr) > 0.5) {
        anyMoving = true;
      }

      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
    }

    if (!anyMoving) {
      fx.rafId = 0;
      return;
    }
    fx.rafId = requestAnimationFrame(step);
  }

  spawnOne();
  fx.rafId = requestAnimationFrame(step);
}

function buildCardElement(card, colIndex, cardIndex, { reuse = true } = {}) {
  const el = reuse ? cardRenderer.getCardElement(card) : cardRenderer.createCardElement(card);
  cardRenderer.resetCardInlineStyles(el);
  el.dataset.pile = 'tableau';
  el.dataset.pileindex = String(colIndex);
  el.dataset.index = String(cardIndex);

  const isSelected = !!(card.faceUp && selection && selection.col === colIndex && cardIndex >= selection.index);
  el.classList.toggle('selected', isSelected);

  return el;
}

function buildCardVisual(card) {
  return cardRenderer.createCardElement(card);
}

function render() {
  // tableau
  tableauEl.innerHTML = '';
  state.tableau.forEach((stack, colIdx) => {
    const spacing = getStackSpacing(stack.length);
    const col = cardRenderer.createStackElement({ className: 'tableau-col', dataset: { col: colIdx } });
    stack.forEach((card, idx) => {
      const el = buildCardElement(card, colIdx, idx);
      el.style.top = `${idx * spacing}px`;
      col.appendChild(el);
    });
    tableauEl.appendChild(col);
  });

  // stock
  stockEl.innerHTML = '';
  const back = document.createElement('div');
  back.className = 'card-back';
  if (state.stock.length === 0) back.classList.add('empty');
  stockEl.appendChild(back);
  const dealsLeft = Math.floor(state.stock.length / 10);
  const stockCount = document.createElement('div');
  stockCount.className = 'stock-count';
  stockCount.textContent = String(dealsLeft);
  if (dealsLeft === 0) stockCount.classList.add('empty');
  stockEl.appendChild(stockCount);

  // completed runs (ace markers)
  if (completedAcesEl) {
    const slots = Array.from(completedAcesEl.querySelectorAll('.run-slot'));
    const runs = state.completedRuns || [];
    if (slots.length) {
      slots.forEach((slot, idx) => {
        slot.innerHTML = '';
        slot.classList.toggle('empty', !runs[idx]);
      });
      runs.slice(0, slots.length).forEach((suit, idx) => {
        const ace = buildCardVisual({ suit, value: 1, faceUp: true });
        ace.classList.add('ace-marker');
        slots[idx].appendChild(ace);
      });
    } else {
      completedAcesEl.innerHTML = '';
      runs.forEach((suit) => {
        const ace = buildCardVisual({ suit, value: 1, faceUp: true });
        ace.classList.add('ace-marker');
        completedAcesEl.appendChild(ace);
      });
    }
  }

  completedEl.textContent = String(state.completed);
  dealsEl.textContent = String(dealsLeft);
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

function moveSelectionTo(colIdx, fromDrag = false) {
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
  if (!canDropOn(state.tableau[colIdx], moving[0])) {
    if (!fromDrag) {
      sfx.play(BANK_SPIDER, 'invalid');
    }
    return false;
  }

  pushUndo();
  state.tableau[col] = fromStack.slice(0, index);
  state.tableau[colIdx] = state.tableau[colIdx].concat(moving);

  const newTop = state.tableau[col][state.tableau[col].length - 1];
  if (newTop && !newTop.faceUp) {
    newTop.faceUp = true;
    sfx.play(BANK_SPIDER, 'flip');
  }

  selection = null;
  const removedSuits = [];
  let removedSuit = checkCompletedRuns(colIdx);
  while (removedSuit) {
    removedSuits.push(removedSuit);
    removedSuit = checkCompletedRuns(colIdx);
  }

  render();
  if (removedSuits.length) {
    removedSuits.forEach(() => sfx.play(BANK_SPIDER, 'stackComplete'));
    updateStatus(`Completed ${removedSuits.length} run${removedSuits.length === 1 ? '' : 's'}!`);
  } else {
    updateStatus('Moved');
  }
  sfx.play(BANK_SPIDER, 'place');
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
        const suit = prev.suit;
        const runCards = stack.slice(i - 1);
        // remove run
        state.tableau[colIdx] = stack.slice(0, i - 1);
        state.completed += 1;
        if (!state.completedRuns) state.completedRuns = [];
        state.completedRuns.push(suit);
        if (!state.completedCards) state.completedCards = [];
        state.completedCards.push(...runCards);
        const newTop = state.tableau[colIdx][state.tableau[colIdx].length - 1];
        if (newTop) newTop.faceUp = true;
        return suit;
      }
    } else {
      run = 1;
    }
  }
  return null;
}

function dealFromStock() {
  unlockAudio();
  if (state.stock.length === 0) {
    updateStatus('No more deals.');
    sfx.play(BANK_SPIDER, 'invalid');
    return;
  }
  if (state.tableau.some((col) => col.length === 0)) {
    updateStatus('Cannot deal: empty column present.');
    sfx.play(BANK_SPIDER, 'invalid');
    return;
  }
  pushUndo();
  let dealt = 0;
  for (let i = 0; i < 10; i++) {
    const card = state.stock.pop();
    if (!card) break;
    card.faceUp = true;
    state.tableau[i].push(card);
    dealt += 1;
  }
  if (dealt > 0) {
    sfx.play(BANK_SPIDER, 'dealRow', { count: dealt });
  }

  const removedSuits = [];
  for (let colIdx = 0; colIdx < 10; colIdx++) {
    let removedSuit = checkCompletedRuns(colIdx);
    while (removedSuit) {
      removedSuits.push(removedSuit);
      removedSuit = checkCompletedRuns(colIdx);
    }
  }

  if (removedSuits.length) {
    removedSuits.forEach(() => sfx.play(BANK_SPIDER, 'stackComplete'));
    updateStatus(`Dealt and completed ${removedSuits.length} run${removedSuits.length === 1 ? '' : 's'}!`);
  } else {
    updateStatus('Dealt one card to each column.');
  }
  render();
}

function handlePointerDown(ev) {
  unlockAudio();
  const cardEl = ev.target instanceof HTMLElement ? ev.target.closest('.card') : null;
  if (!cardEl || !tableauEl.contains(cardEl)) return;
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
    stackSpacing: getStackSpacing(state.tableau[col].length),
  };
  render();
  sfx.play(BANK_SPIDER, 'pickup');
}

function buildDragPreview(cards, colIdx, startIndex, spacing) {
  if (!dragPreviewCache.el) {
    const wrap = document.createElement('div');
    wrap.className = 'drag-preview';
    wrap.style.display = 'none';
    wrap.style.willChange = 'transform';
    document.body.appendChild(wrap);
    dragPreviewCache.el = wrap;
  } else if (!dragPreviewCache.el.parentElement) {
    document.body.appendChild(dragPreviewCache.el);
  }
  const wrap = dragPreviewCache.el;
  wrap.style.display = '';
  wrap.style.transform = 'translate(-9999px, -9999px)';
  cards.forEach((card, idx) => {
    let el = dragPreviewCache.cards[idx];
    if (!el) {
      el = cardRenderer.createCardElement(card, { className: 'selected' });
      el.style.position = 'absolute';
      dragPreviewCache.cards[idx] = el;
      wrap.appendChild(el);
    } else {
      cardRenderer.updateCardElement(el, card, { className: 'selected' });
      el.style.display = '';
    }
    el.style.top = `${idx * spacing}px`;
  });
  for (let i = cards.length; i < dragPreviewCache.cards.length; i++) {
    dragPreviewCache.cards[i].style.display = 'none';
  }
  return wrap;
}

function updateDragPreviewPosition(clientX, clientY) {
  if (!dragState || !dragState.preview) return;
  const x = clientX - dragState.offsetX;
  const y = clientY - dragState.offsetY;
  dragState.preview.style.transform = `translate(${x}px, ${y}px)`;
}

function clearDragPreview() {
  if (dragState?.preview) {
    dragState.preview.style.display = 'none';
    dragState.preview.style.transform = 'translate(-9999px, -9999px)';
    dragState.preview = null;
  }
}

function attemptDrop(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let handled = false;
  if (target) {
    const colEl = target.closest('.tableau-col');
    if (colEl) {
      const colIdx = Number(colEl.dataset.col);
      handled = moveSelectionTo(colIdx, true);
    }
  }
  if (!handled) {
    if (selection) {
      sfx.play(BANK_SPIDER, 'invalid');
    }
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
    dragState.preview = buildDragPreview(cards, selection.col, selection.index, dragState.stackSpacing ?? cardLayout.metrics.stackSpacing);
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
  unlockAudio();
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

  if (undoBtn) undoBtn.addEventListener('click', undo);
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z')) {
      ev.preventDefault();
      undo();
    }
  });

  window.addEventListener('resize', () => {
    if (!state) return;
    render();
  });

  // Initialize layout system
  cardLayout.init({
    constraints: [{ columns: 10, element: tableauEl }],
    observeElements: [tableauEl],
    onUpdate: () => state && render(),
  });

  newBtn.addEventListener('click', () => newGame());
  dealBtn.addEventListener('click', () => dealFromStock());
  difficultySelect.addEventListener('change', () => newGame());
}

attachEvents();
newGame();
document.addEventListener('pointerdown', unlockAudio, { once: true });
