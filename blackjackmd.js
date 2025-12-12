// Dr. Blackjack - Unicode cards, multiple options, and basic-strategy hints.

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = {
  clubs: '\u2663\uFE0F',
  diamonds: '\u2666\uFE0F',
  hearts: '\u2665\uFE0F',
  spades: '\u2660\uFE0F',
};
const VALUE_LABELS = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };
const ACTIONS = { STAND: 'stand', HIT: 'hit', DOUBLE: 'double', SPLIT: 'split', SURRENDER: 'surrender' };

const dealerEl = document.getElementById('dealer-hand');
const dealerStatusEl = document.getElementById('dealer-status');
const dealerOutcomeEl = document.getElementById('dealer-outcome');
const playerHandsEl = document.getElementById('player-hands');
const statusEl = document.getElementById('status');
const bankEl = document.getElementById('bank');
const betInput = document.getElementById('bet');

const dealBtn = document.getElementById('deal');
const hitBtn = document.getElementById('hit');
const standBtn = document.getElementById('stand');
const doubleBtn = document.getElementById('double');
const splitBtn = document.getElementById('split');
const surrenderBtn = document.getElementById('surrender');
const hintBtn = document.getElementById('hint');
const newRoundBtn = document.getElementById('new-round');

const decksSelect = document.getElementById('decks');
const optEuropean = document.getElementById('opt-european');
const optSurrender = document.getElementById('opt-surrender');
const optDAS = document.getElementById('opt-das');
const optDoubleAny = document.getElementById('opt-double-any');
const optHitSoft17 = document.getElementById('opt-hit-soft17');

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

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function createShoe(decks) {
  const shoe = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (let value = 1; value <= 13; value++) {
        shoe.push({ id: `${d}-${suit}-${value}-${Math.random()}`, suit, value, faceUp: true });
      }
    }
  }
  shuffle(shoe);
  return shoe;
}

function ensureShoe() {
  const minCards = Math.max(20, state.options.decks * 10);
  if (!state.shoe || state.shoeDecks !== state.options.decks || state.shoe.length < minCards) {
    state.shoe = createShoe(state.options.decks);
    state.shoeDecks = state.options.decks;
  }
}

function drawCard(faceUp = true) {
  ensureShoe();
  const card = state.shoe.pop();
  card.faceUp = faceUp;
  return card;
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
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
  return { total, soft, aces };
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

function initialState() {
  return {
    shoe: createShoe(1),
    shoeDecks: 1,
    dealer: [],
    hands: [],
    activeHand: 0,
    bank: 1000,
    bet: 10,
    inRound: false,
    roundOver: false,
    options: {
      decks: 8,
      europeanNoHoleCard: false,
      allowSurrender: false,
      allowDAS: true,
      doubleAny: true,
      dealerHitsSoft17: false,
    },
  };
}

function updateOptionsFromUI() {
  state.options.decks = Number(decksSelect.value) || 1;
  state.options.europeanNoHoleCard = !!(optEuropean && optEuropean.checked);
  state.options.allowSurrender = optSurrender.checked;
  state.options.allowDAS = optDAS.checked;
  state.options.doubleAny = optDoubleAny.checked;
  state.options.dealerHitsSoft17 = optHitSoft17.checked;
}

function updateBankAndBet() {
  const bet = Math.max(1, Math.min(state.bank, Number(betInput.value) || 1));
  state.bet = bet;
  betInput.value = String(bet);
  bankEl.textContent = String(state.bank);
}

function getActiveHand() {
  return state.hands[state.activeHand];
}

function canSplit(hand) {
  if (!state.inRound || !hand || hand.finished) return false;
  if (hand.cards.length !== 2) return false;
  if (state.hands.length >= 4) return false;
  if (state.bank < hand.bet) return false;
  const [a, b] = hand.cards;
  return a.value === b.value;
}

function canDouble(hand) {
  if (!state.inRound || !hand || hand.finished) return false;
  if (hand.cards.length !== 2) return false;
  if (hand.doubled || hand.surrendered) return false;
  if (hand.fromSplit && !state.options.allowDAS) return false;
  if (state.bank < hand.bet) return false;
  if (!state.options.doubleAny) {
    const hv = handValue(hand.cards);
    return hv.total === 10 || hv.total === 11;
  }
  return true;
}

function revealDealerHole() {
  if (state.dealer[1]) state.dealer[1].faceUp = true;
  return state.dealer[1];
}

function startRound() {
  updateOptionsFromUI();
  updateBankAndBet();
  if (state.bet > state.bank) {
    statusEl.textContent = 'Bet exceeds bank.';
    return;
  }

  state.dealer = state.options.europeanNoHoleCard ? [drawCard(true)] : [drawCard(true), drawCard(false)];
  state.hands = [
    {
      cards: [drawCard(true), drawCard(true)],
      bet: state.bet,
      stood: false,
      busted: false,
      doubled: false,
      surrendered: false,
      finished: false,
      fromSplit: false,
      natural: false,
      hasActed: false,
      result: '',
    },
  ];
  state.activeHand = 0;
  state.bank -= state.bet;
  state.inRound = true;
  state.roundOver = false;

  state.hands[0].natural = isBlackjack(state.hands[0].cards);

  renderHands();
  statusEl.textContent = 'Hit, stand, split, double, surrender, or hint.';
  checkNaturals();
  updateButtons();
}

function checkNaturals() {
  const playerNatural = state.hands.length === 1 && state.hands[0].natural;
  if (state.options.europeanNoHoleCard) {
    if (!playerNatural) return;
    statusEl.textContent = 'Blackjack! Waiting for dealer...';
    state.hands[0].finished = true;
    state.hands[0].hasActed = true;
    renderHands();
    advanceTurn();
    return;
  }

  const dealerNatural = handValue([state.dealer[0], state.dealer[1]]).total === 21;
  if (!playerNatural && !dealerNatural) return;

  revealDealerHole();
  state.inRound = false;
  state.roundOver = true;

  const payouts = [];
  if (dealerNatural && playerNatural) {
    state.bank += state.bet;
    state.hands[0].result = 'Push (blackjack)';
    payouts.push('Push (BJ)');
  } else if (playerNatural) {
    const payout = state.bet + Math.floor(state.bet * 1.5);
    state.bank += payout;
    state.hands[0].result = 'Blackjack!';
    payouts.push('Blackjack pays 3:2');
  } else {
    state.hands[0].result = 'Dealer blackjack';
    payouts.push('Dealer blackjack');
  }

  renderHands();
  updateButtons();
  statusEl.textContent = payouts.join(' | ');
}

function hit() {
  const hand = getActiveHand();
  if (!hand || hand.finished) return;
  hand.cards.push(drawCard(true));
  hand.hasActed = true;
  if (handValue(hand.cards).total > 21) {
    hand.busted = true;
    hand.finished = true;
  }
  renderHands();
  advanceTurn();
}

function stand() {
  const hand = getActiveHand();
  if (!hand || hand.finished) return;
  hand.stood = true;
  hand.finished = true;
  hand.hasActed = true;
  renderHands();
  advanceTurn();
}

function doubleDown() {
  const hand = getActiveHand();
  if (!canDouble(hand)) return;
  state.bank -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.hasActed = true;
  hand.cards.push(drawCard(true));
  if (handValue(hand.cards).total > 21) {
    hand.busted = true;
  }
  hand.finished = true;
  renderHands();
  advanceTurn();
}

function splitHand() {
  const hand = getActiveHand();
  if (!canSplit(hand)) return;
  const [cardA, cardB] = hand.cards;

  hand.cards = [cardA, drawCard(true)];
  hand.fromSplit = true;
  hand.natural = false;
  hand.hasActed = false;

  const newHand = {
    cards: [cardB, drawCard(true)],
    bet: hand.bet,
    stood: false,
    busted: false,
    doubled: false,
    surrendered: false,
    finished: false,
    fromSplit: true,
    natural: false,
    hasActed: false,
    result: '',
  };

  state.bank -= hand.bet;
  state.hands.splice(state.activeHand + 1, 0, newHand);
  renderHands();
  updateButtons();
}

function surrender() {
  const hand = getActiveHand();
  if (!hand || hand.finished) return;
  if (!state.options.allowSurrender) return;
  if (hand.cards.length !== 2) return;
  if (hand.hasActed) return;
  hand.surrendered = true;
  hand.finished = true;
  hand.result = 'Surrender';
  renderHands();
  advanceTurn();
}

function advanceTurn() {
  const previousActiveHand = state.activeHand;
  while (state.activeHand < state.hands.length && state.hands[state.activeHand].finished) {
    state.activeHand += 1;
  }
  if (state.activeHand >= state.hands.length) {
    dealerPlayAndSettle();
  } else if (state.activeHand !== previousActiveHand) {
    renderHands();
  }
  updateButtons();
}

function dealerPlayAndSettle() {
  state.inRound = false;
  const needsDealerResolve = state.hands.some((hand) => !hand.busted && !hand.surrendered);
  const needsDealerHit = state.hands.some((hand) => !hand.busted && !hand.surrendered && !hand.natural);

  if (state.options.europeanNoHoleCard) {
    if (needsDealerResolve && state.dealer.length === 1) {
      state.dealer.push(drawCard(true));
    }
  } else {
    revealDealerHole();
  }

  let dv = handValue(state.dealer);
  if (needsDealerHit) {
    while (dv.total < 17 || (dv.total === 17 && dv.soft && state.options.dealerHitsSoft17)) {
      state.dealer.push(drawCard(true));
      dv = handValue(state.dealer);
    }
  }

  settleHands(dv);
  state.roundOver = true;
  renderHands();
  updateButtons();
}

function settleHands(dealerValue) {
  const dealerBust = dealerValue.total > 21;
  const dealerNatural = state.dealer.length === 2 && dealerValue.total === 21;

  let totalPayout = 0;
  const summaries = [];

  for (let i = 0; i < state.hands.length; i++) {
    const hand = state.hands[i];
    const hv = handValue(hand.cards);

    let payout = 0;
    let result = '';

    if (hand.surrendered) {
      payout = hand.bet / 2;
      result = 'Surrender (-0.5 bet)';
    } else if (hand.busted) {
      result = 'Busted';
    } else if (dealerBust) {
      payout = hand.bet * 2;
      result = 'Win (dealer bust)';
    } else if (dealerNatural && hand.natural) {
      payout = hand.bet;
      result = 'Push (blackjack)';
    } else if (dealerNatural && !hand.natural) {
      result = 'Dealer blackjack';
    } else if (hand.natural) {
      payout = hand.bet + Math.floor(hand.bet * 1.5);
      result = 'Blackjack!';
    } else if (hv.total > dealerValue.total) {
      payout = hand.bet * 2;
      result = 'Win';
    } else if (hv.total < dealerValue.total) {
      result = 'Lose';
    } else {
      payout = hand.bet;
      result = 'Push';
    }

    hand.result = result;
    totalPayout += payout;
    summaries.push(`Hand ${i + 1}: ${result}`);
  }

  state.bank += Math.floor(totalPayout);
  statusEl.textContent = summaries.join(' | ');
}

function softSuffix(hv) {
  return hv.soft ? ' (soft)' : '';
}

function outcomeLineForHand(hand, dealerTotal) {
  if (!hand.cards.length) return '';
  const hv = handValue(hand.cards);
  const soft = softSuffix(hv);
  if (hand.surrendered) return `Surrendered — Total: ${hv.total}${soft}`;
  if (hand.busted) return `Busted with ${hv.total}`;
  if (state.roundOver && typeof dealerTotal === 'number') {
    const result = hand.result ? ` — ${hand.result}` : '';
    return `Final: ${hv.total}${soft} vs Dealer: ${dealerTotal}${result}`;
  }
  if (hand.finished) {
    if (hand.stood) return `Stood on ${hv.total}${soft}`;
    if (hand.doubled) return `Doubled to ${hv.total}${soft}`;
  }
  return `Total: ${hv.total}${soft}`;
}

function renderHands() {
  renderHand(dealerEl, state.dealer, state.inRound && !state.roundOver);

  if (!state.dealer.length) {
    dealerStatusEl.textContent = '';
    dealerOutcomeEl.textContent = '';
  } else {
    const europeanNoHole = !!state.options.europeanNoHoleCard;
    const holeHidden = state.inRound && !state.roundOver && state.dealer[1] && !state.dealer[1].faceUp;
    if (holeHidden) {
      const visibleCards = state.dealer.filter((c) => c.faceUp);
      const showing = visibleCards.length ? handValue(visibleCards).total : 0;
      dealerStatusEl.textContent = `Showing: ${showing}`;
      dealerOutcomeEl.textContent = `Upcard: ${formatCardLabel(state.dealer[0])}`;
    } else {
      const dv = handValue(state.dealer);
      dealerStatusEl.textContent = state.roundOver ? `Total: ${dv.total}` : europeanNoHole && state.dealer.length === 1 ? `Showing: ${dv.total}` : `Total: ${dv.total}`;
      if (state.roundOver) {
        dealerOutcomeEl.textContent = dv.total > 21 ? `Busted with ${dv.total}` : `Final total: ${dv.total}`;
      } else if (europeanNoHole && state.dealer.length === 1) {
        dealerOutcomeEl.textContent = 'No hole card (European).';
      } else {
        dealerOutcomeEl.textContent = `Current total: ${dv.total}`;
      }
    }
  }

  const dealerTotal = state.roundOver && state.dealer.length ? handValue(state.dealer).total : null;

  playerHandsEl.innerHTML = '';
  state.hands.forEach((hand, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'hand';
    if (state.inRound && idx === state.activeHand) wrap.classList.add('active');

    const header = document.createElement('div');
    header.className = 'hand-header';
    let status = hand.result;
    if (!status) {
      if (hand.busted) status = 'BUST';
      else if (hand.surrendered) status = 'SURRENDER';
      else if (state.inRound && idx === state.activeHand && !hand.finished) status = 'Playing';
      else status = '';
    }
    header.innerHTML = `<span>Hand ${idx + 1} - Bet $${hand.bet}</span><span class="hand-status">${status}</span>`;
    wrap.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'hand-cards card-grid';
    hand.cards.forEach((card) => {
      cardsWrap.appendChild(buildCardElement(card));
    });
    wrap.appendChild(cardsWrap);

    const outcome = document.createElement('div');
    outcome.className = 'hand-outcome';
    outcome.textContent = outcomeLineForHand(hand, dealerTotal);
    wrap.appendChild(outcome);

    playerHandsEl.appendChild(wrap);
  });

  bankEl.textContent = String(state.bank);
}

function renderHand(container, hand, hideHole = false) {
  container.innerHTML = '';
  hand.forEach((card, idx) => {
    const displayCard = hideHole && idx === 1 ? { ...card, faceUp: false } : card;
    container.appendChild(buildCardElement(card, displayCard));
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
    if (displayCard.value === 7) {
      pips.classList.add('pips-seven');
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

function updateButtons() {
  const hand = state.inRound ? getActiveHand() : null;
  dealBtn.disabled = state.inRound || state.bank <= 0;
  hitBtn.disabled = !hand || hand.finished;
  standBtn.disabled = !hand || hand.finished;
  doubleBtn.disabled = !hand || !canDouble(hand);
  splitBtn.disabled = !hand || !canSplit(hand);
  surrenderBtn.disabled = !hand || !state.options.allowSurrender || hand.cards.length !== 2 || hand.hasActed || hand.finished;
  hintBtn.disabled = !hand;
  newRoundBtn.disabled = state.inRound || state.bank <= 0;
}

function getCardTotal(hand) {
  const ct = { aces: 0, sum: 0, numberOfCards: hand.cards.length, pair: false };
  for (const c of hand.cards) {
    if (c.value === 1) ct.aces += 1;
    ct.sum += c.value >= 10 ? 10 : c.value;
  }
  if (hand.cards.length === 2) {
    ct.pair = hand.cards[0].value === hand.cards[1].value;
  }
  return ct;
}

function chooseChart() {
  // Map options to closest chart from the original sources (chart1..chart9).
  const { decks, allowDAS, doubleAny, dealerHitsSoft17 } = state.options;
  if (decks === 1) {
    if (!doubleAny && dealerHitsSoft17) return chart7;
    if (!doubleAny) return chart6;
    if (allowDAS) return chart5;
    return chart4;
  }
  if (decks === 2) {
    if (allowDAS) return chart9;
    return chart8;
  }
  if (!doubleAny) return chart3;
  if (!allowDAS) return chart2;
  return chart1;
}

function hint() {
  const hand = getActiveHand();
  if (!hand) return;
  const dealerUp = state.dealer[0];
  const ct = getCardTotal(hand);

  let action = chooseChart()(ct, dealerUp, state.options);
  if (action === ACTIONS.DOUBLE && !canDouble(hand)) action = ACTIONS.HIT;
  if (action === ACTIONS.SPLIT && !canSplit(hand)) action = ACTIONS.HIT;
  if (action === ACTIONS.SURRENDER && !state.options.allowSurrender) action = ACTIONS.HIT;

  const text = {
    [ACTIONS.HIT]: 'Hint: Hit',
    [ACTIONS.STAND]: 'Hint: Stand',
    [ACTIONS.DOUBLE]: 'Hint: Double',
    [ACTIONS.SPLIT]: 'Hint: Split',
    [ACTIONS.SURRENDER]: 'Hint: Surrender',
  }[action];
  statusEl.textContent = text || 'Hint unavailable';
}

// Basic-strategy chart1 ported from drbj.cpp (head revision). Other charts are approximated.
function chart1(ct, dealerUpcard, opts) {
  const d = dealerUpcard.value;

  if (ct.numberOfCards === 2) {
    if (ct.aces === 1) {
      switch (ct.sum - 1) {
        case 10:
        case 9:
        case 8:
          return ACTIONS.STAND;
        case 7:
          if ([2, 7, 8].includes(d)) return ACTIONS.STAND;
          if ([3, 4, 5, 6].includes(d)) return ACTIONS.DOUBLE;
          return ACTIONS.HIT;
        case 6:
          if ([3, 4, 5, 6].includes(d)) return ACTIONS.DOUBLE;
          return ACTIONS.HIT;
        case 5:
        case 4:
          if ([4, 5, 6].includes(d)) return ACTIONS.DOUBLE;
          return ACTIONS.HIT;
        case 3:
        case 2:
          if ([5, 6].includes(d)) return ACTIONS.DOUBLE;
          return ACTIONS.HIT;
        default:
          break;
      }
    }

    if (ct.pair) {
      switch (ct.sum / 2) {
        case 10:
          return ACTIONS.STAND;
        case 9:
          if ([7, 10, 11, 12, 13, 1].includes(d)) return ACTIONS.STAND;
          return ACTIONS.SPLIT;
        case 8:
        case 1:
          return ACTIONS.SPLIT;
        case 7:
          if (d >= 2 && d <= 7) return ACTIONS.SPLIT;
          return ACTIONS.HIT;
        case 6:
          if (d >= 2 && d <= 6) return ACTIONS.SPLIT;
          return ACTIONS.HIT;
        case 4:
          if (d === 5 || d === 6) return ACTIONS.SPLIT;
          return ACTIONS.HIT;
        case 3:
        case 2:
          if (d >= 2 && d <= 7) return ACTIONS.SPLIT;
          return ACTIONS.HIT;
        default:
          break;
      }
    }
  }

  if (ct.sum >= 17) return ACTIONS.STAND;

  switch (ct.sum) {
    case 16:
      if (d >= 2 && d <= 6) return ACTIONS.STAND;
      if (opts.allowSurrender) return ACTIONS.SURRENDER;
      return ACTIONS.HIT;
    case 15:
      if (d >= 2 && d <= 6) return ACTIONS.STAND;
      if (opts.allowSurrender) return ACTIONS.SURRENDER;
      return ACTIONS.HIT;
    case 14:
    case 13:
      if (d >= 2 && d <= 6) return ACTIONS.STAND;
      return ACTIONS.HIT;
    case 12:
      if (d >= 4 && d <= 6) return ACTIONS.STAND;
      return ACTIONS.HIT;
    case 11:
      if (d === 1) return ACTIONS.HIT;
      return ACTIONS.DOUBLE;
    case 10:
      if (d >= 10 || d === 1) return ACTIONS.HIT;
      return ACTIONS.DOUBLE;
    case 9:
      if (d >= 3 && d <= 6) return ACTIONS.DOUBLE;
      return ACTIONS.HIT;
    default:
      return ACTIONS.HIT;
  }
}

function chart2(ct, dealerUpcard, opts) {
  return chart1(ct, dealerUpcard, opts);
}

function chart3(ct, dealerUpcard, opts) {
  const base = chart1(ct, dealerUpcard, opts);
  if (base !== ACTIONS.DOUBLE) return base;
  const total = ct.sum;
  return total === 10 || total === 11 ? ACTIONS.DOUBLE : ACTIONS.HIT;
}

function chart4(ct, dealerUpcard, opts) {
  return chart1(ct, dealerUpcard, opts);
}

function chart5(ct, dealerUpcard, opts) {
  return chart1(ct, dealerUpcard, opts);
}

function chart6(ct, dealerUpcard, opts) {
  return chart3(ct, dealerUpcard, opts);
}

function chart7(ct, dealerUpcard, opts) {
  return chart3(ct, dealerUpcard, opts);
}

function chart8(ct, dealerUpcard, opts) {
  return chart1(ct, dealerUpcard, opts);
}

function chart9(ct, dealerUpcard, opts) {
  return chart1(ct, dealerUpcard, opts);
}

function newRound() {
  state.dealer = [];
  state.hands = [];
  state.activeHand = 0;
  state.inRound = false;
  state.roundOver = false;
  updateOptionsFromUI();
  updateBankAndBet();
  renderHands();
  statusEl.textContent = 'Place your bet and deal.';
  updateButtons();
}

function attachEvents() {
  dealBtn.addEventListener('click', startRound);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', doubleDown);
  splitBtn.addEventListener('click', splitHand);
  surrenderBtn.addEventListener('click', surrender);
  hintBtn.addEventListener('click', hint);
  newRoundBtn.addEventListener('click', newRound);
  betInput.addEventListener('change', updateBankAndBet);
  [decksSelect, optEuropean, optSurrender, optDAS, optDoubleAny, optHitSoft17].forEach((el) =>
    el.addEventListener('change', updateOptionsFromUI),
  );
}

state = initialState();
attachEvents();
newRound();
