/**
 * Card rendering and DOM element management.
 * Handles card creation, pooling, and visual updates.
 */

const DEFAULT_CLASSES = {
  card: 'card',
  content: 'card-content',
  cornerTop: 'corner top',
  cornerBottom: 'corner bottom',
  pips: 'pips',
  pip: 'pip',
  faceLabel: 'face-label',
};

const DEFAULT_STATE_CLASSES = {
  faceDown: 'face-down',
  red: 'red',
};

const PIP_LAYOUTS = {
  1: [10],
  2: [1, 19],
  3: [1, 10, 19],
  4: [0, 2, 18, 20],
  5: [0, 2, 10, 18, 20],
  6: [0, 2, 9, 11, 18, 20],
  7: [0, 2, 3, 5, 6, 8, 4],
  8: [0, 2, 3, 5, 6, 8, 9, 11],
  9: [0, 2, 3, 5, 6, 8, 9, 11, 4],
  10: [0, 2, 3, 5, 6, 8, 9, 11, 4, 7],
};

const getPipsModifiers = (value) => {
  const classes = [];
  if (value === 1) classes.push('pips-ace');
  if (value >= 2 && value <= 6) classes.push('pips-low');
  if (value === 4 || value === 5) classes.push('pips-center');
  if (value >= 7) classes.push('pips-tight', 'pips-compact-4');
  if (value === 7) classes.push('pips-seven');
  return classes;
};

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
export const SUIT_SYMBOLS = {
  clubs: '\u2663\uFE0F',
  diamonds: '\u2666\uFE0F',
  hearts: '\u2665\uFE0F',
  spades: '\u2660\uFE0F',
};
export const VALUE_LABELS = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

export function cardColor(suit) {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

export function pipLayout(value) {
  return PIP_LAYOUTS[value] || [];
}

export function formatCardLabel(card, valueLabels = VALUE_LABELS, suitSymbols = SUIT_SYMBOLS) {
  return `${valueLabels[card.value]}${suitSymbols[card.suit]}`;
}

export class CardRenderer {
  constructor(options = {}) {
    this.suitSymbols = options.suitSymbols || SUIT_SYMBOLS;
    this.valueLabels = options.valueLabels || VALUE_LABELS;
    this.pipLayout = options.pipLayout || pipLayout;
    this.faceValueStart = options.faceValueStart ?? 11;
    this.classes = { ...DEFAULT_CLASSES, ...(options.classes || {}) };
    this.stateClasses = { ...DEFAULT_STATE_CLASSES, ...(options.stateClasses || {}) };
    this._cardPool = new Map();
  }

  formatCardLabel(card) {
    return formatCardLabel(card, this.valueLabels, this.suitSymbols);
  }

  clearCardPool() {
    this._cardPool.clear();
  }

  getCardElement(card, options = {}) {
    if (!card || card.id == null) return this.createCardElement(card, options);
    let el = this._cardPool.get(card.id);
    if (!el) {
      el = this.createCardElement(card, options);
      this._cardPool.set(card.id, el);
    } else {
      this.updateCardElement(el, card, options);
    }
    return el;
  }

  resetCardInlineStyles(el) {
    if (!el) return;
    el.style.top = '';
    el.style.left = '';
    el.style.zIndex = '';
  }

  updateCardElement(el, card, options = {}) {
    if (!el) return this.createCardElement(card, options);
    const { faceUp, className } = options;

    // Reset classes
    el.className = this.classes.card;
    if (className) {
      const tokens = Array.isArray(className) ? className : String(className).split(' ');
      tokens.filter(Boolean).forEach((c) => el.classList.add(c));
    }

    const showFace = faceUp ?? (card && card.faceUp);
    const cache = el._cardCache || (el._cardCache = {});

    if (!card || !showFace) {
      el.classList.add(this.stateClasses.faceDown);
      if (cache.content?.parentElement === el) el.removeChild(cache.content);
      cache.cardKey = null;
      return el;
    }

    if (cardColor(card.suit) === 'red') el.classList.add(this.stateClasses.red);

    const cardKey = `${card.value}|${card.suit}`;
    const isFace = card.value >= this.faceValueStart;

    // Only rebuild if card identity changed
    if (cache.cardKey === cardKey && cache.isFace === isFace) {
      if (cache.content && cache.content.parentElement !== el) el.appendChild(cache.content);
      return el;
    }

    let content = cache.content;
    if (!content) {
      content = document.createElement('div');
      cache.content = content;
    }
    content.className = this.classes.content;
    while (content.firstChild) content.removeChild(content.firstChild);

    const label = this.formatCardLabel(card);
    content.appendChild(this._buildCorner(this.classes.cornerTop, label));
    content.appendChild(this._buildCorner(this.classes.cornerBottom, label));

    if (isFace) {
      const face = document.createElement('div');
      face.className = this.classes.faceLabel;
      face.textContent = this.valueLabels[card.value];
      content.appendChild(face);
    } else {
      const pips = document.createElement('div');
      pips.className = this.classes.pips;
      getPipsModifiers(card.value).forEach((cls) => pips.classList.add(cls));

      const layout = this.pipLayout(card.value);
      const pipSymbol = this.suitSymbols[card.suit];
      const frag = document.createDocumentFragment();
      layout.forEach((cell) => {
        const pip = document.createElement('div');
        pip.className = this.classes.pip;
        pip.style.gridRow = String(Math.floor(cell / 3) + 1);
        pip.style.gridColumn = String((cell % 3) + 1);
        pip.textContent = pipSymbol;
        frag.appendChild(pip);
      });
      pips.appendChild(frag);
      content.appendChild(pips);
    }

    if (content.parentElement !== el) el.appendChild(content);
    cache.cardKey = cardKey;
    cache.isFace = isFace;
    return el;
  }

  createCardElement(card, options = {}) {
    return this.updateCardElement(document.createElement('div'), card, options);
  }

  _buildCorner(className, label) {
    const corner = document.createElement('div');
    corner.className = className;
    corner.textContent = label;
    return corner;
  }

  // Layout helper methods
  createStackElement(options = {}) {
    const el = document.createElement('div');
    el.className = 'card-stack';
    if (options.className) el.classList.add(...options.className.split(' ').filter(Boolean));
    if (options.dataset) Object.entries(options.dataset).forEach(([k, v]) => el.dataset[k] = v);
    return el;
  }

  createRowElement(options = {}) {
    const el = document.createElement('div');
    el.className = 'card-row';
    if (options.nowrap) el.classList.add('card-row--nowrap');
    if (options.scroll) el.classList.add('card-row--scroll');
    return el;
  }

  applyRowClasses(el, options = {}) {
    if (!el) return el;
    el.classList.add('card-row');
    if (options.nowrap) el.classList.add('card-row--nowrap');
    if (options.scroll) el.classList.add('card-row--scroll');
    return el;
  }
}
