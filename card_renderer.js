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

const defaultGetPipsModifiers = (value) => {
  const classes = [];
  if (value >= 7) {
    classes.push('pips-tight', 'pips-compact-4');
  }
  if (value === 7) {
    classes.push('pips-seven');
  }
  return classes;
};

const defaultGetPipSizeClass = (value) => {
  if (value >= 9 && value <= 10) return 'pip-xsmall';
  if (value >= 5 && value <= 8) return 'pip-small';
  return '';
};

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
export const SUIT_SYMBOLS = {
  clubs: '\u2663\uFE0F',
  diamonds: '\u2666\uFE0F',
  hearts: '\u2665\uFE0F',
  spades: '\u2660\uFE0F',
};
export const VALUE_LABELS = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export function cardColor(suit) {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black';
}

export function pipLayout(value) {
  // Default positions mapped to a 3x7 grid (indices 0..20)
  const defaults = {
    1: [10],
    2: [1, 19],
    3: [1, 10, 19],
    4: [0, 2, 18, 20],
    5: [0, 2, 10, 18, 20],
    6: [0, 2, 9, 11, 18, 20],
    7: [0, 2, 3, 5, 6, 8, 4], // compact 3x4 grid indices (shifted via CSS)
    8: [0, 2, 3, 5, 6, 8, 9, 11], // compact 3x4 grid indices
  };
  if (value === 9) {
    // 3x4 grid (indices 0..11): 8 on sides + 1 center
    return [0, 2, 3, 5, 6, 8, 9, 11, 4];
  }
  if (value === 10) {
    // 3x4 grid: 8 on sides + 2 centers
    return [0, 2, 3, 5, 6, 8, 9, 11, 4, 7];
  }
  return defaults[value] || [];
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
    this.getPipSizeClass = options.getPipSizeClass || defaultGetPipSizeClass;
    this.getPipsModifiers = options.getPipsModifiers || defaultGetPipsModifiers;
    this.skin = options.skin || null;
    this.size = options.size || null;
    this.dataset = { ...(options.dataset || {}) };
    this.getDataset = typeof options.getDataset === 'function' ? options.getDataset : null;
  }

  formatCardLabel(card) {
    return formatCardLabel(card, this.valueLabels, this.suitSymbols);
  }

  createCardElement(card, options = {}) {
    const { faceUp, skin, size, dataset, className, attributes } = options;
    const el = document.createElement('div');
    el.className = this.classes.card;
    if (className) {
      const tokens = Array.isArray(className) ? className : String(className).split(' ').filter(Boolean);
      if (tokens.length) el.classList.add(...tokens);
    }

    const resolvedSkin = skin ?? this.skin;
    const resolvedSize = size ?? this.size;
    const runtimeDataset = this.getDataset ? this.getDataset(card, options) : null;
    const computedDataset = {
      ...this.dataset,
      ...(runtimeDataset || {}),
      ...(dataset || {}),
    };
    if (resolvedSkin) computedDataset.skin = resolvedSkin;
    if (resolvedSize) computedDataset.size = resolvedSize;
    Object.entries(computedDataset).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      el.dataset[key] = String(value);
    });
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        el.setAttribute(key, String(value));
      });
    }

    const showFace = faceUp ?? (card && card.faceUp);
    if (!card || !showFace) {
      el.classList.add(this.stateClasses.faceDown);
      return el;
    }

    if (cardColor(card.suit) === 'red') {
      el.classList.add(this.stateClasses.red);
    }

    const content = document.createElement('div');
    content.className = this.classes.content;

    const cornerTop = document.createElement('div');
    cornerTop.className = this.classes.cornerTop;
    cornerTop.textContent = this.formatCardLabel(card);
    content.appendChild(cornerTop);

    const cornerBottom = document.createElement('div');
    cornerBottom.className = this.classes.cornerBottom;
    cornerBottom.textContent = this.formatCardLabel(card);
    content.appendChild(cornerBottom);

    if (card.value >= this.faceValueStart) {
      const face = document.createElement('div');
      face.className = this.classes.faceLabel;
      face.textContent = this.valueLabels[card.value];
      content.appendChild(face);
    } else {
      const pips = document.createElement('div');
      pips.className = this.classes.pips;
      this.getPipsModifiers(card.value).forEach((cls) => pips.classList.add(cls));

      this.pipLayout(card.value).forEach((cell) => {
        const pip = document.createElement('div');
        pip.className = this.classes.pip;
        const sizeClass = this.getPipSizeClass(card.value);
        if (sizeClass) pip.classList.add(sizeClass);
        const row = Math.floor(cell / 3) + 1;
        const col = (cell % 3) + 1;
        pip.style.gridRow = String(row);
        pip.style.gridColumn = String(col);
        pip.textContent = this.suitSymbols[card.suit];
        pips.appendChild(pip);
      });

      content.appendChild(pips);
    }

    el.appendChild(content);
    return el;
  }
}
