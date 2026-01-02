/**
 * Unicode Solitaire (Klondike) compiled to plain JS for the browser.
 * Mirrors the logic in solitaire.ts.
 */

import { SfxEngine } from './sfx_engine.js';
import { BANK_KLONDIKE } from './card_sfx_banks.js';
import { CardRenderer, SUITS, cardColor } from './card_renderer.js';

const DEFAULT_STACK_SPACING = 26;
const DEFAULT_WASTE_SPACING = 16;
const DEFAULT_CARD_WIDTH = 88;
const DEFAULT_CARD_HEIGHT = 120;
const VIEWPORT_BOTTOM_MARGIN = 28;
const TIGHTEN_START = 10;
const TIGHTEN_END = 24;

const sfx = new SfxEngine({ master: 0.6 });
const cardRenderer = new CardRenderer();
let audioUnlocked = false;

const layoutRoot = document.getElementById('app') || document.body;
const layoutDefaults = {
  cardWidth: DEFAULT_CARD_WIDTH,
  cardHeight: DEFAULT_CARD_HEIGHT,
  stackSpacing: DEFAULT_STACK_SPACING,
  wasteSpacing: DEFAULT_WASTE_SPACING,
};
let layoutMetrics = cardRenderer.readLayoutMetrics({
  root: layoutRoot,
  defaults: layoutDefaults,
  minStackSpacingMin: 10,
});

function refreshLayoutMetrics() {
  layoutMetrics = cardRenderer.readLayoutMetrics({
    root: layoutRoot,
    defaults: layoutDefaults,
    minStackSpacingMin: 10,
  });
}

function applyBoardScale() {
  if (!tableauEl) return;
  cardRenderer.applyBoardScale({
    root: document.documentElement,
    constraints: [{ columns: 7, available: tableauEl.clientWidth }],
    minScale: 0.6,
  });
}

function tableauSpacingForStack(stackLength, tableauTop) {
  const spacing = layoutMetrics.stackSpacing;
  if (stackLength <= 1) return spacing;
  const availableHeight = Math.max(0, window.innerHeight - tableauTop - VIEWPORT_BOTTOM_MARGIN);
  const fitSpacing = (availableHeight - layoutMetrics.cardHeight) / (stackLength - 1);

  const t = stackLength <= TIGHTEN_START ? 0 : Math.min(1, (stackLength - TIGHTEN_START) / (TIGHTEN_END - TIGHTEN_START));
  const desiredSpacing = spacing - t * (spacing - layoutMetrics.minStackSpacing);

  return Math.max(0, Math.min(spacing, desiredSpacing, fitSpacing));
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
let winFx = null;

const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const foundationRowEl = document.querySelector('.foundation-row');
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

cardRenderer.applyRowClasses(foundationRowEl);
cardRenderer.applyStackRowClasses(tableauEl);

let dragState = null;
const dragPreviewCache = { el: null, cards: [] };

function cleanupDanglingPreviews() {
  if (dragState && dragState.preview) return;
  if (!dragPreviewCache.el) return;
  dragPreviewCache.el.style.display = 'none';
  dragPreviewCache.el.style.transform = 'translate(-9999px, -9999px)';
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
    won: !!current.won,
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

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  sfx.unlock();
}

function updateVegasBank() {
  if (options.scoreMode === 'vegas') {
    vegasBank = state.score;
  }
}

function newGame() {
  stopWinCelebration();
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
    won: false,
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
  unlockAudio();
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
  sfx.play(BANK_KLONDIKE, 'deal');
}

function handleRedeal() {
  if (state.waste.length === 0) return;

  const threshold = getRedealThreshold();
  if (options.scoreMode === 'vegas' && state.wasteRedeals >= threshold) {
    statusEl.textContent = 'No more redeals in Vegas mode.';
    sfx.play(BANK_KLONDIKE, 'invalid');
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
  sfx.play(BANK_KLONDIKE, 'deal');
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
  let flipped = false;
  if (origin.source === 'tableau') {
    const stack = state.tableau[origin.pileIndex];
    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top.faceUp) {
        top.faceUp = true;
        flipped = true;
        if (options.scoreMode === 'standard') {
          state.score += 5;
          updateVegasBank();
        }
      }
    }
  }
  return flipped;
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

function moveSelectionToTableau(targetIndex, fromDrag = false) {
  if (!selection) return false;
  if (selection.source === 'tableau' && selection.pileIndex === targetIndex) {
    selection = null;
    render();
    return false;
  }
  const moving = peekSelectedCards();
  if (moving.length === 0) return false;
  const targetStack = state.tableau[targetIndex];
  if (!canMoveToTableau(moving[0], targetStack)) {
    if (!fromDrag) {
      sfx.play(BANK_KLONDIKE, 'invalid');
    }
    return false;
  }

  setUndoSnapshot();
  const origin = selection;
  const moved = takeSelectedCards();
  targetStack.push(...moved);
  applyTableauScoring(origin);
  sfx.play(BANK_KLONDIKE, 'place');
  if (flipTopIfNeeded(origin)) {
    sfx.play(BANK_KLONDIKE, 'flip');
  }
  selection = null;
  state.started = true;
  startTimer();
  render();
  return true;
}

function moveSelectionToFoundation(targetIndex, fromDrag = false) {
  if (!selection) return false;
  if (selection.source === 'foundation') return false;
  const moving = peekSelectedCards();
  if (moving.length !== 1) return false;

  const destIndex = targetIndex !== undefined ? targetIndex : getFoundationIndex(moving[0].suit);
  const stack = state.foundations[destIndex];
  if (!canMoveToFoundation(moving[0], stack)) {
    if (!fromDrag) {
      sfx.play(BANK_KLONDIKE, 'invalid');
    }
    return false;
  }
  if (selection.source === 'tableau') {
    const sourceStack = state.tableau[selection.pileIndex];
    if (selection.cardIndex !== sourceStack.length - 1) {
      if (!fromDrag) {
        sfx.play(BANK_KLONDIKE, 'invalid');
      }
      return false;
    }
  }

  setUndoSnapshot();
  const origin = selection;
  const card = takeSelectedCards()[0];
  stack.push(card);
  applyFoundationScoring(origin);
  sfx.play(BANK_KLONDIKE, 'foundation');
  if (flipTopIfNeeded(origin)) {
    sfx.play(BANK_KLONDIKE, 'flip');
  }
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
      sfx.play(BANK_KLONDIKE, 'foundation');
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
        sfx.play(BANK_KLONDIKE, 'foundation');
        if (flipTopIfNeeded({ source: 'tableau', pileIndex: i, cardIndex: col.length })) {
          sfx.play(BANK_KLONDIKE, 'flip');
        }
        render();
        checkForWin();
        return true;
      }
    }
  }
  return false;
}

function autoMoveAll() {
  unlockAudio();
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
  unlockAudio();
  sfx.play(BANK_KLONDIKE, 'undo');
  stopWinCelebration();
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
  if (complete && !state.won) {
    state.won = true;
    clearUndo();
    state.started = false;
    stopTimer();
    selection = null;
    sfx.play(BANK_KLONDIKE, 'win');
    render();
    startWinCelebration();
  }
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
  msg.textContent = `You win! Score: ${state.score} Time: ${formatTime(state.timeSeconds)} (New Game to restart)`;
  overlay.appendChild(msg);
  document.body.appendChild(overlay);

  const piles = state.foundations.map((stack, idx) => ({ idx, cards: stack.slice() }));
  const pending = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const pile of piles) {
      if (!pile.cards.length) continue;
      remaining = true;
      const card = pile.cards.pop();
      pending.push({ card, origin: foundationEls[pile.idx].getBoundingClientRect() });
    }
  }

  const particles = [];
  const fx = { overlay, particles, pending, running: true, rafId: 0, spawnTimer: 0, lastTime: performance.now() };
  winFx = fx;

  function spawnOne() {
    if (!fx.running) return;
    const next = fx.pending.pop();
    if (!next) return;
    const card = { suit: next.card.suit, value: next.card.value, faceUp: true };

    const el = buildCardElement(card, 'foundation', 0, 0);
    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '0px';
    overlay.appendChild(el);

    const startX = next.origin.left + Math.random() * Math.max(0, next.origin.width - layoutMetrics.cardWidth);
    const startY = next.origin.top + Math.random() * Math.max(0, next.origin.height - layoutMetrics.cardHeight);
    const vx = (Math.random() * 2 - 1) * 760;
    const vy = -(720 + Math.random() * 980);
    const rot = (Math.random() * 2 - 1) * 35;
    const vr = (Math.random() * 2 - 1) * 420;

    particles.push({ el, x: startX, y: startY, vx, vy, rot, vr, resting: false });
    el.style.transform = `translate(${startX}px, ${startY}px) rotate(${rot}deg)`;

    fx.spawnTimer = setTimeout(spawnOne, 55);
  }

  function step(now) {
    if (!fx.running) return;
    const dt = Math.min(0.05, (now - fx.lastTime) / 1000);
    fx.lastTime = now;

    const gravity = 2600;
    const wallBounce = 0.86;
    const floorBounce = 0.78;
    const maxY = window.innerHeight - layoutMetrics.cardHeight;
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

      if (p.x + layoutMetrics.cardWidth < 0 || p.x > window.innerWidth) {
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

function updateStatus() {
  scoreEl.textContent = options.scoreMode === 'none' ? '-' : state.score.toString();
  timeEl.textContent = formatTime(state.timeSeconds);
  const drawLabel = options.drawCount === 1 ? 'Draw 1' : 'Draw 3';
  const modeLabel = options.scoreMode === 'none' ? 'No score' : options.scoreMode === 'standard' ? 'Standard score' : 'Vegas score';
  statusEl.textContent = state.won ? 'You win! Click New Game to play again.' : `${drawLabel} | ${modeLabel}`;
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

function buildCardElement(card, pileType, cardIndex, pileIndex, { reuse = true } = {}) {
  const el = reuse ? cardRenderer.getCardElement(card) : cardRenderer.createCardElement(card);
  cardRenderer.resetCardInlineStyles(el);
  el.dataset.pile = pileType;
  el.dataset.index = cardIndex.toString();
  if (pileIndex !== undefined) {
    el.dataset.pileindex = pileIndex.toString();
    el.dataset.col = pileIndex.toString();
  }

  let isSelected = false;
  if (selection) {
    const selectedPileMatches = selection.source === pileType && selection.pileIndex === (pileIndex ?? 0);
    if (selectedPileMatches) {
      if (pileType === 'tableau') {
        isSelected = cardIndex >= selection.cardIndex;
      }
      if ((pileType === 'waste' || pileType === 'foundation') && cardIndex === selection.cardIndex) {
        isSelected = true;
      }
    }
  }
  el.classList.toggle('selected', isSelected);

  return el;
}

function buildDragPreview(cards, source, startIndex, pileIndex) {
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
  const spacing = dragState && typeof dragState.stackSpacing === 'number' ? dragState.stackSpacing : layoutMetrics.stackSpacing;
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
  if (dragState && dragState.preview) {
    dragState.preview.style.display = 'none';
    dragState.preview.style.transform = 'translate(-9999px, -9999px)';
  }
  if (dragState) {
    dragState.preview = null;
  }
  cardRenderer.cancelDragUpdate(dragState);
  cleanupDanglingPreviews();
}

function attemptDrop(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  let handled = false;
  if (target) {
    const foundation = target.closest('.foundation');
    if (foundation) {
      const idx = Number(foundation.dataset.index ?? foundation.dataset.pileindex ?? 0);
      handled = moveSelectionToFoundation(idx, true);
    }
    if (!handled) {
      const colEl = target.closest('.tableau-col');
      if (colEl) {
        const idx = Number(colEl.dataset.col ?? 0);
        handled = moveSelectionToTableau(idx, true);
      }
    }
  }
  if (!handled) {
    if (selection) {
      sfx.play(BANK_KLONDIKE, 'invalid');
    }
    selection = null;
    render();
  }
  return handled;
}

function handlePointerDown(ev) {
  unlockAudio();
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
    raf: 0,
    pendingX: 0,
    pendingY: 0,
  };
  if (selection.source === 'tableau') {
    dragState.stackSpacing = tableauSpacingForStack(state.tableau[selection.pileIndex].length, tableauEl.getBoundingClientRect().top);
  } else {
    dragState.stackSpacing = layoutMetrics.stackSpacing;
  }
  sfx.play(BANK_KLONDIKE, 'pickup');
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
  cardRenderer.scheduleDragUpdate(dragState, ev.clientX, ev.clientY, updateDragPreviewPosition);
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
    el.style.left = `${i * layoutMetrics.wasteSpacing}px`;
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
    const col = cardRenderer.createStackElement({ className: 'tableau-col', dataset: { col: colIdx } });
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
  applyBoardScale();
  refreshLayoutMetrics();
  cardRenderer.updateScaleFromCSS();
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
document.addEventListener('pointerdown', unlockAudio, { once: true });
