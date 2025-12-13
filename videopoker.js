// Video Poker (9-6 Jacks or Better), plain JS + emoji/unicode cards.

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = { clubs: '\u2663\uFE0F', diamonds: '\u2666\uFE0F', hearts: '\u2665\uFE0F', spades: '\u2660\uFE0F' };
const VALUE_LABELS = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

const BET = 5;
const PAY_TABLE = [
  { key: 'Royal Flush', label: 'ROYAL FLUSH', payouts: [250, 500, 750, 1000, 4000] },
  { key: 'Straight Flush', label: 'STRAIGHT FLUSH', payouts: [50, 100, 150, 200, 250] },
  { key: 'Four of a Kind', label: '4 OF A KIND', payouts: [25, 50, 75, 100, 125] },
  { key: 'Full House', label: 'FULL HOUSE', payouts: [9, 18, 27, 36, 45] },
  { key: 'Flush', label: 'FLUSH', payouts: [6, 12, 18, 24, 30] },
  { key: 'Straight', label: 'STRAIGHT', payouts: [4, 8, 12, 16, 20] },
  { key: 'Three of a Kind', label: '3 OF A KIND', payouts: [3, 6, 9, 12, 15] },
  { key: 'Two Pair', label: '2 PAIR', payouts: [2, 4, 6, 8, 10] },
  { key: 'Jacks or Better', label: 'JACKS OR BETTER', payouts: [1, 2, 3, 4, 5] },
];

const creditsEl = document.getElementById('credits');
const betEl = document.getElementById('bet');
const winEl = document.getElementById('win');
const statusEl = document.getElementById('status');
const handNameEl = document.getElementById('hand-name');
const handOutcomeEl = document.getElementById('hand-outcome');
const cardsEl = document.getElementById('cards');
const paytableEl = document.getElementById('paytable');
const dealBtn = document.getElementById('deal');
const newGameBtn = document.getElementById('new-game');

let state = initialState();
const paytableRowEls = new Map();

function initialState() {
  return {
    credits: 50,
    deck: [],
    hand: [null, null, null, null, null],
    hold: [false, false, false, false, false],
    roundEnded: true,
    lastWin: 0,
    eval: { name: '', win: 0 },
    message: 'Click Deal to start.',
  };
}

function cardColor(suit) {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

function pipLayout(value) {
  const defaults = {
    1: [10],
    2: [1, 19],
    3: [1, 10, 19],
    4: [0, 2, 18, 20],
    5: [0, 2, 10, 18, 20],
    6: [0, 2, 9, 11, 18, 20],
    7: [0, 2, 3, 5, 6, 8, 4],
    8: [0, 2, 3, 5, 6, 8, 9, 11],
  };
  if (value === 9) return [0, 2, 3, 5, 6, 8, 9, 11, 4];
  if (value === 10) return [0, 2, 3, 5, 6, 8, 9, 11, 4, 7];
  return defaults[value] || [];
}

function formatCardLabel(card) {
  return `${VALUE_LABELS[card.value]}${SUIT_SYMBOLS[card.suit]}`;
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

function buildCardVisual(card) {
  const el = document.createElement('div');
  el.className = 'card';

  if (!card || !card.faceUp) {
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
    if (card.value === 7) {
      pips.classList.add('pips-seven');
    }
    pipLayout(card.value).forEach((cell) => {
      pips.appendChild(formatPipElement(card, cell));
    });
    content.appendChild(pips);
  }

  el.appendChild(content);
  return el;
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

function drawCard() {
  const card = state.deck.pop();
  return card || null;
}

function payoutFor(name) {
  const row = PAY_TABLE.find((r) => r.key === name);
  return row ? row.payouts[BET - 1] : 0;
}

function evaluateHand(cards) {
  if (!cards || cards.some((c) => !c)) return { name: '', win: 0 };

  const suits = cards.map((c) => c.suit);
  const values = cards.map((c) => c.value);

  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const countValues = Array.from(counts.values()).sort((a, b) => b - a);

  const isFlush = suits.every((s) => s === suits[0]);

  const uniq = Array.from(new Set(values));
  let isStraight = false;
  let straightHigh = 0;
  if (uniq.length === 5) {
    const sortedLow = uniq.slice().sort((a, b) => a - b);
    const isWheel = sortedLow[0] === 1 && sortedLow[1] === 2 && sortedLow[2] === 3 && sortedLow[3] === 4 && sortedLow[4] === 5;
    if (isWheel) {
      isStraight = true;
      straightHigh = 5;
    } else {
      const sortedHigh = uniq
        .slice()
        .map((v) => (v === 1 ? 14 : v))
        .sort((a, b) => a - b);
      const consecutive = sortedHigh.every((v, i) => i === 0 || v === sortedHigh[i - 1] + 1);
      if (consecutive) {
        isStraight = true;
        straightHigh = sortedHigh[4];
      }
    }
  }

  if (isFlush && isStraight && straightHigh === 14 && values.includes(10)) {
    return { name: 'Royal Flush', win: payoutFor('Royal Flush') };
  }
  if (isFlush && isStraight) {
    return { name: 'Straight Flush', win: payoutFor('Straight Flush') };
  }
  if (countValues[0] === 4) {
    return { name: 'Four of a Kind', win: payoutFor('Four of a Kind') };
  }
  if (countValues[0] === 3 && countValues[1] === 2) {
    return { name: 'Full House', win: payoutFor('Full House') };
  }
  if (isFlush) {
    return { name: 'Flush', win: payoutFor('Flush') };
  }
  if (isStraight) {
    return { name: 'Straight', win: payoutFor('Straight') };
  }
  if (countValues[0] === 3) {
    return { name: 'Three of a Kind', win: payoutFor('Three of a Kind') };
  }
  if (countValues[0] === 2 && countValues[1] === 2) {
    return { name: 'Two Pair', win: payoutFor('Two Pair') };
  }
  if (countValues[0] === 2) {
    const pairValue = Array.from(counts.entries()).find(([, c]) => c === 2)?.[0] ?? 0;
    if (pairValue === 1 || pairValue >= 11) {
      return { name: 'Jacks or Better', win: payoutFor('Jacks or Better') };
    }
  }

  return { name: '', win: 0 };
}

function buildPaytable() {
  if (!paytableEl) return;
  paytableEl.innerHTML = '';
  paytableRowEls.clear();

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const hName = document.createElement('th');
  hName.textContent = 'HAND';
  hr.appendChild(hName);
  for (let i = 1; i <= 5; i++) {
    const th = document.createElement('th');
    th.textContent = String(i);
    if (i === BET) th.classList.add('active');
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  const tbody = document.createElement('tbody');
  PAY_TABLE.forEach((row) => {
    const tr = document.createElement('tr');
    tr.dataset.key = row.key;

    const tdName = document.createElement('td');
    tdName.textContent = row.label;
    tr.appendChild(tdName);

    row.payouts.forEach((p, idx) => {
      const td = document.createElement('td');
      td.textContent = String(p);
      if (idx === BET - 1) td.classList.add('active');
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    paytableRowEls.set(row.key, tr);
  });

  paytableEl.appendChild(thead);
  paytableEl.appendChild(tbody);
}

function dealNewHand() {
  state.credits -= BET;
  state.deck = createDeck();
  shuffle(state.deck);
  state.hand = [drawCard(), drawCard(), drawCard(), drawCard(), drawCard()];
  state.hold = [false, false, false, false, false];
  state.roundEnded = false;
  state.lastWin = 0;
  state.eval = evaluateHand(state.hand);
  state.message = 'Select cards to hold, then click Draw.';
}

function drawReplacements() {
  for (let i = 0; i < 5; i++) {
    if (!state.hold[i]) {
      state.hand[i] = drawCard();
    }
  }
  state.roundEnded = true;
  state.eval = evaluateHand(state.hand);
  state.lastWin = state.eval.win;
  state.credits += state.lastWin;
  state.message = state.lastWin ? `Won ${state.lastWin} (${state.eval.name})` : 'No win. Click Deal to play again.';
}

function toggleHold(index) {
  if (state.roundEnded) return;
  if (index < 0 || index > 4) return;
  if (!state.hand[index]) return;
  state.hold[index] = !state.hold[index];
}

function renderCards() {
  if (!cardsEl) return;
  cardsEl.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'vp-card-wrap';
    wrap.dataset.index = String(i);
    if (!state.roundEnded) wrap.classList.add('holdable');
    if (state.hold[i]) wrap.classList.add('held');

    const card = state.hand[i] || { faceUp: false };
    wrap.appendChild(buildCardVisual(card));

    const hold = document.createElement('div');
    hold.className = 'vp-hold-label';
    hold.textContent = 'HOLD';
    wrap.appendChild(hold);

    cardsEl.appendChild(wrap);
  }
}

function renderPaytableHighlight() {
  paytableRowEls.forEach((tr) => tr.classList.remove('winner', 'blink'));
  if (!state.eval.name) return;
  const tr = paytableRowEls.get(state.eval.name);
  if (!tr) return;
  tr.classList.add('winner');
  if (state.roundEnded && state.eval.win > 0) {
    tr.classList.add('blink');
  }
}

function render() {
  creditsEl.textContent = String(state.credits);
  betEl.textContent = String(BET);
  winEl.textContent = String(state.lastWin);
  statusEl.textContent = state.message;

  dealBtn.textContent = state.roundEnded ? 'Deal' : 'Draw';

  const name = state.eval.name ? state.eval.name.toUpperCase() : '';
  handNameEl.textContent = name;

  if (state.hand.some((c) => c)) {
    if (state.roundEnded) {
      handOutcomeEl.textContent = state.eval.win ? `Payout: +${state.eval.win} credits` : 'No payout';
    } else {
      handOutcomeEl.textContent = state.eval.name ? `Current: ${state.eval.name} (${state.eval.win} @ bet 5)` : 'Current: no win yet';
    }
  } else {
    handOutcomeEl.textContent = '';
  }

  renderCards();
  renderPaytableHighlight();
}

function attachEvents() {
  dealBtn.addEventListener('click', () => {
    if (state.roundEnded) {
      dealNewHand();
    } else {
      drawReplacements();
    }
    render();
  });

  newGameBtn.addEventListener('click', () => {
    state = initialState();
    render();
  });

  cardsEl.addEventListener('click', (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target.closest('.vp-card-wrap') : null;
    if (!target) return;
    const idx = Number(target.dataset.index);
    toggleHold(idx);
    state.eval = evaluateHand(state.hand);
    render();
  });
}

function main() {
  buildPaytable();
  attachEvents();
  render();
}

main();

