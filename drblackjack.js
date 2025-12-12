// Dr. Blackjack - single deck blackjack using the same card rendering as solitaire.

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = { clubs: '\u2663\uFE0F', diamonds: '\u2666\uFE0F', hearts: '\u2665\uFE0F', spades: '\u2660\uFE0F' };
const VALUE_LABELS = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };

const dealerEl = document.getElementById('dealer-hand');
const playerEl = document.getElementById('player-hand');
const statusEl = document.getElementById('status');
const bankEl = document.getElementById('bank');
const betInput = document.getElementById('bet');
const dealBtn = document.getElementById('deal');
const hitBtn = document.getElementById('hit');
const standBtn = document.getElementById('stand');
const doubleBtn = document.getElementById('double');
const newRoundBtn = document.getElementById('new-round');

const TABLEAU_SPACING = 22;

let state;

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

function newShoe() {
  const deck = createDeck();
  shuffle(deck);
  return deck;
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.value === 1) {
      aces += 1;
      total += 11;
    } else if (c.value >= 10) {
      total += 10;
    } else {
      total += c.value;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const soft = aces > 0 && total <= 21;
  return { total, soft };
}

function initialState() {
  return {
    shoe: newShoe(),
    dealer: [],
    player: [],
    bank: 1000,
    bet: 10,
    inRound: false,
    roundOver: false,
  };
}

function ensureShoe() {
  if (state.shoe.length < 15) {
    state.shoe = newShoe();
  }
}

function drawCard(faceUp = true) {
  ensureShoe();
  const card = state.shoe.pop();
  card.faceUp = faceUp;
  return card;
}

function renderHand(container, hand, hideHole = false) {
  container.innerHTML = '';
  hand.forEach((card, idx) => {
    const el = buildCardElement(card, hideHole && idx === 1 ? { ...card, faceUp: false } : card);
    el.style.position = 'relative';
    el.style.top = '0';
    container.appendChild(el);
  });
}

function buildCardElement(card, displayCard = card) {
  const el = document.createElement('div');
  el.className = 'card';
  if (!displayCard.faceUp) {
    el.classList.add('face-down');
    return el;
  }
  if (cardColor(displayCard.suit) === 'red') {
    el.classList.add('red');
  }
  const content = document.createElement('div');
  content.className = 'card-content';

  const cornerTop = document.createElement('div');
  cornerTop.className = 'corner top';
  cornerTop.textContent = formatCardLabel(displayCard);
  content.appendChild(cornerTop);

  const cornerBottom = document.createElement('div');
  cornerBottom.className = 'corner bottom';
  cornerBottom.textContent = formatCardLabel(displayCard);
  content.appendChild(cornerBottom);

  if (displayCard.value >= 11) {
    const face = document.createElement('div');
    face.className = 'face-label';
    face.textContent = VALUE_LABELS[displayCard.value];
    content.appendChild(face);
  } else {
    const pips = document.createElement('div');
    pips.className = 'pips';
    if (displayCard.value >= 7) {
      pips.classList.add('pips-tight', 'pips-compact-4');
    }
    pipLayout(displayCard.value).forEach((cell) => {
      const pip = document.createElement('div');
      pip.className = 'pip';
      if (displayCard.value >= 9 && displayCard.value <= 10) {
        pip.classList.add('pip-xsmall');
      } else if (displayCard.value >= 5 && displayCard.value <= 8) {
        pip.classList.add('pip-small');
      }
      const row = Math.floor(cell / 3) + 1;
      const col = (cell % 3) + 1;
      pip.style.gridRow = String(row);
      pip.style.gridColumn = String(col);
      pip.textContent = SUIT_SYMBOLS[displayCard.suit];
      pips.appendChild(pip);
    });
    content.appendChild(pips);
  }

  el.appendChild(content);
  return el;
}

function updateBankAndBet() {
  bankEl.textContent = String(state.bank);
  const bet = Math.max(1, Math.min(state.bank, Number(betInput.value) || 1));
  state.bet = bet;
  betInput.value = String(bet);
}

function setButtons({ deal = false, hit = false, stand = false, double = false, newRound = false }) {
  dealBtn.disabled = !deal;
  hitBtn.disabled = !hit;
  standBtn.disabled = !stand;
  doubleBtn.disabled = !double;
  newRoundBtn.disabled = !newRound;
}

function startRound() {
  updateBankAndBet();
  if (state.bet > state.bank) {
    statusEl.textContent = 'Bet exceeds bank.';
    return;
  }
  state.inRound = true;
  state.roundOver = false;
  state.bank -= state.bet;
  state.dealer = [drawCard(true), drawCard(false)];
  state.player = [drawCard(true), drawCard(true)];
  statusEl.textContent = 'Hit, stand, or double.';
  renderHands();
  setButtons({ hit: true, stand: true, double: true, deal: false, newRound: false });
  checkNaturals();
}

function endRound(message, payout = 0) {
  state.roundOver = true;
  state.inRound = false;
  state.bank += payout;
  statusEl.textContent = message;
  renderHand(dealerEl, state.dealer, false);
  bankEl.textContent = String(state.bank);
  setButtons({ deal: state.bank > 0, newRound: true });
}

function playerValue() {
  return handValue(state.player);
}

function dealerValue() {
  return handValue(state.dealer);
}

function checkNaturals() {
  const p = playerValue();
  const d = dealerValue();
  if (p.total === 21 && state.player.length === 2) {
    // player blackjack
    if (d.total === 21 && state.dealer.length === 2) {
      state.dealer[1].faceUp = true;
      endRound('Push: both blackjack.', state.bet);
    } else {
      state.dealer[1].faceUp = true;
      endRound('Blackjack! Pays 3:2.', state.bet + Math.floor(state.bet * 2.5));
    }
  } else if (d.total === 21 && state.dealer.length === 2) {
    state.dealer[1].faceUp = true;
    endRound('Dealer blackjack.', 0);
  }
}

function hit() {
  if (!state.inRound) return;
  state.player.push(drawCard(true));
  renderHands();
  const pv = playerValue();
  if (pv.total > 21) {
    state.dealer[1].faceUp = true;
    endRound('Player busts.', 0);
  }
}

function stand() {
  if (!state.inRound) return;
  state.dealer[1].faceUp = true;
  // dealer hits to 17, hits soft 17
  while (true) {
    const dv = dealerValue();
    if (dv.total < 17 || (dv.total === 17 && dv.soft)) {
      state.dealer.push(drawCard(true));
    } else {
      break;
    }
  }
  renderHands();
  settle();
}

function doubleDown() {
  if (!state.inRound) return;
  if (state.bank < state.bet) {
    statusEl.textContent = 'Not enough bank to double.';
    return;
  }
  state.bank -= state.bet;
  state.bet *= 2;
  state.player.push(drawCard(true));
  renderHands();
  const pv = playerValue();
  if (pv.total > 21) {
    state.dealer[1].faceUp = true;
    endRound('Player busts.', 0);
  } else {
    stand();
  }
}

function settle() {
  const pv = playerValue();
  const dv = dealerValue();
  let msg = '';
  let payout = state.bet;
  if (pv.total > 21) {
    msg = 'Player busts.';
    payout = 0;
  } else if (dv.total > 21) {
    msg = 'Dealer busts. You win!';
    payout = state.bet * 2;
  } else if (pv.total > dv.total) {
    msg = 'You win!';
    payout = state.bet * 2;
  } else if (pv.total < dv.total) {
    msg = 'Dealer wins.';
    payout = 0;
  } else {
    msg = 'Push.';
    payout = state.bet;
  }
  endRound(msg, payout);
}

function newRound() {
  state.dealer = [];
  state.player = [];
  state.bet = Math.max(1, Math.min(state.bank, Number(betInput.value) || 1));
  state.inRound = false;
  state.roundOver = false;
  updateBankAndBet();
  setButtons({ deal: state.bank > 0 });
  renderHands();
  statusEl.textContent = 'Place your bet and deal.';
}

function renderHands() {
  renderHand(dealerEl, state.dealer, !state.roundOver && state.inRound);
  renderHand(playerEl, state.player, false);
  bankEl.textContent = String(state.bank);
}

function attachEvents() {
  dealBtn.addEventListener('click', startRound);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', doubleDown);
  newRoundBtn.addEventListener('click', newRound);
  betInput.addEventListener('change', updateBankAndBet);
}

state = initialState();
attachEvents();
newRound();
