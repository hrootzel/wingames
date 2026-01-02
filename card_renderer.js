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

const DEFAULT_LAYOUT_CLASSES = {
  row: 'card-row',
  rowNoWrap: 'card-row--nowrap',
  rowScroll: 'card-row--scroll',
  stackRow: 'card-stack-row',
  stack: 'card-stack',
};

const PIP_LAYOUT_DEFAULTS = {
  1: [10],
  2: [1, 19],
  3: [1, 10, 19],
  4: [0, 2, 18, 20],
  5: [0, 2, 10, 18, 20],
  6: [0, 2, 9, 11, 18, 20],
  7: [0, 2, 3, 5, 6, 8, 4], // compact 3x4 grid indices (shifted via CSS)
  8: [0, 2, 3, 5, 6, 8, 9, 11], // compact 3x4 grid indices
};
const PIP_LAYOUT_9 = [0, 2, 3, 5, 6, 8, 9, 11, 4];
const PIP_LAYOUT_10 = [0, 2, 3, 5, 6, 8, 9, 11, 4, 7];

const readScaleFromCSS = (root = document.documentElement) => {
  if (!root || typeof getComputedStyle !== 'function') return null;
  const styles = getComputedStyle(root);
  const scaleValue = parseFloat(styles.getPropertyValue('--card-scale'));
  return Number.isFinite(scaleValue) ? scaleValue : null;
};

const getNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const normalizeClassTokens = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(' ').filter(Boolean);
};

const applyDataset = (el, dataset) => {
  if (!dataset) return;
  Object.entries(dataset).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    el.dataset[key] = String(value);
  });
};

const applyAttributes = (el, attributes) => {
  if (!attributes) return;
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    el.setAttribute(key, String(value));
  });
};

const buildCorner = (className, label) => {
  const corner = document.createElement('div');
  corner.className = className;
  corner.textContent = label;
  return corner;
};

const defaultGetPipsModifiers = (value) => {
  const classes = [];
  if (value === 1) {
    classes.push('pips-ace');
  }
  if (value >= 2 && value <= 6) {
    classes.push('pips-low');
  }
  if (value === 4 || value === 5) {
    classes.push('pips-center');
  }
  if (value >= 7) {
    classes.push('pips-tight', 'pips-compact-4');
  }
  if (value === 7) {
    classes.push('pips-seven');
  }
  return classes;
};

const defaultGetPipSizeClass = (value, context = {}) => {
  const scale = typeof context.scale === 'number' ? context.scale : 1;
  const shrink = scale < 0.95;
  const shrinkHard = scale < 0.8;
  if (value >= 9) return 'pip-xsmall';
  if (value >= 5) {
    if (shrinkHard) return 'pip-xsmall';
    if (shrink && value <= 7) return 'pip-xsmall';
    return 'pip-small';
  }
  if (shrinkHard) return 'pip-xsmall';
  if (shrink) return 'pip-small';
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
  if (value === 9) {
    // 3x4 grid (indices 0..11): 8 on sides + 1 center
    return PIP_LAYOUT_9;
  }
  if (value === 10) {
    // 3x4 grid: 8 on sides + 2 centers
    return PIP_LAYOUT_10;
  }
  return PIP_LAYOUT_DEFAULTS[value] || [];
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
    this.scale = typeof options.scale === 'number' ? options.scale : null;
    this.layoutClasses = { ...DEFAULT_LAYOUT_CLASSES, ...(options.layoutClasses || {}) };
    this.dataset = { ...(options.dataset || {}) };
    this.getDataset = typeof options.getDataset === 'function' ? options.getDataset : null;
    this._cardPool = new Map();
  }

  updateScaleFromCSS(root = document.documentElement) {
    const scaleValue = readScaleFromCSS(root);
    if (scaleValue !== null) {
      this.scale = scaleValue;
      this._scaleCache = { root, value: scaleValue, time: getNow() };
    }
  }

  resolveScale(options = {}) {
    if (typeof options.scale === 'number') return options.scale;
    if (typeof this.scale === 'number') return this.scale;
    const root = options.root || document.documentElement;
    const now = getNow();
    if (this._scaleCache && this._scaleCache.root === root && now - this._scaleCache.time < 16) {
      return this._scaleCache.value;
    }
    const scaleValue = readScaleFromCSS(root);
    const resolved = scaleValue !== null ? scaleValue : 1;
    this._scaleCache = { root, value: resolved, time: now };
    return resolved;
  }

  formatCardLabel(card) {
    return formatCardLabel(card, this.valueLabels, this.suitSymbols);
  }

  applyLayoutClasses(el, baseClass, options = {}) {
    if (!el) return null;
    const { className, dataset, attributes } = options;
    const tokens = normalizeClassTokens(className);
    if (tokens.length) {
      el.classList.add(baseClass, ...tokens);
    } else {
      el.classList.add(baseClass);
    }
    applyDataset(el, dataset);
    applyAttributes(el, attributes);
    return el;
  }

  createContainerElement(baseClass, options = {}) {
    const el = document.createElement('div');
    return this.applyLayoutClasses(el, baseClass, options);
  }

  applyRowClasses(el, options = {}) {
    if (!el) return null;
    const { nowrap, scroll, className, dataset, attributes } = options;
    this.applyLayoutClasses(el, this.layoutClasses.row, { className, dataset, attributes });
    if (nowrap) el.classList.add(this.layoutClasses.rowNoWrap);
    if (scroll) el.classList.add(this.layoutClasses.rowScroll);
    return el;
  }

  createRowElement(options = {}) {
    const el = document.createElement('div');
    return this.applyRowClasses(el, options);
  }

  applyStackRowClasses(el, options = {}) {
    return this.applyLayoutClasses(el, this.layoutClasses.stackRow, options);
  }

  createStackRowElement(options = {}) {
    const el = document.createElement('div');
    return this.applyStackRowClasses(el, options);
  }

  applyStackClasses(el, options = {}) {
    return this.applyLayoutClasses(el, this.layoutClasses.stack, options);
  }

  createStackElement(options = {}) {
    const el = document.createElement('div');
    return this.applyStackClasses(el, options);
  }

  scheduleDragUpdate(dragState, clientX, clientY, onUpdate) {
    if (!dragState || typeof onUpdate !== 'function') return;
    dragState.pendingX = clientX;
    dragState.pendingY = clientY;
    if (dragState.raf) return;
    if (typeof requestAnimationFrame !== 'function') {
      if (dragState.dragging) onUpdate(dragState.pendingX, dragState.pendingY);
      return;
    }
    dragState.raf = requestAnimationFrame(() => {
      if (!dragState) return;
      dragState.raf = 0;
      if (!dragState.dragging) return;
      onUpdate(dragState.pendingX, dragState.pendingY);
    });
  }

  cancelDragUpdate(dragState) {
    if (!dragState || !dragState.raf) return;
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(dragState.raf);
    }
    dragState.raf = 0;
  }

  readLayoutMetrics(options = {}) {
    const {
      root = document.documentElement,
      defaults = {},
      minStackSpacingScale = 0.5,
      minStackSpacingMin = 8,
    } = options;
    const styles = getComputedStyle(root);
    const cardWidth = parseFloat(styles.getPropertyValue('--card-width')) || defaults.cardWidth || 88;
    const cardHeight = parseFloat(styles.getPropertyValue('--card-height')) || defaults.cardHeight || 120;
    const stackSpacing = parseFloat(styles.getPropertyValue('--stack-spacing')) || defaults.stackSpacing || 24;
    const wasteSpacing = parseFloat(styles.getPropertyValue('--waste-spacing')) || defaults.wasteSpacing || 16;
    return {
      cardWidth,
      cardHeight,
      stackSpacing,
      wasteSpacing,
      minStackSpacing: Math.max(minStackSpacingMin, Math.round(stackSpacing * minStackSpacingScale)),
    };
  }

  readBaseLayoutMetrics(options = {}) {
    const { root = document.documentElement, defaults = {} } = options;
    const styles = getComputedStyle(root);
    const cardBaseWidth = parseFloat(styles.getPropertyValue('--card-base-width')) || defaults.cardBaseWidth || 88;
    const cardBaseGap = parseFloat(styles.getPropertyValue('--card-base-gap')) || defaults.cardBaseGap || 12;
    return { cardBaseWidth, cardBaseGap };
  }

  applyBoardScale(options = {}) {
    const {
      root = document.documentElement,
      constraints = [],
      minScale = 0.6,
      maxScale = 1,
      cardBaseWidth,
      cardBaseGap,
    } = options;
    const baseMetrics =
      typeof cardBaseWidth === 'number' && typeof cardBaseGap === 'number'
        ? { cardBaseWidth, cardBaseGap }
        : this.readBaseLayoutMetrics({ root });
    const scales = constraints.map((constraint) => {
      if (!constraint) return 1;
      const required =
        typeof constraint.required === 'number'
          ? constraint.required
          : constraint.columns
            ? constraint.columns * baseMetrics.cardBaseWidth + (constraint.columns - 1) * baseMetrics.cardBaseGap
            : 0;
      const available = constraint.available ?? 0;
      if (required > 0 && available > 0 && required > available) {
        return available / required;
      }
      return 1;
    });
    const unclamped = Math.min(maxScale, ...scales, 1);
    const scale = Math.max(minScale, unclamped);
    root.style.setProperty('--card-scale', scale.toFixed(3));
    return scale;
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
    const { faceUp, skin, size, dataset, className, attributes } = options;
    const tokens = normalizeClassTokens(className);
    el.className = this.classes.card;
    if (tokens.length) el.classList.add(...tokens);

    const resolvedSkin = skin ?? this.skin;
    const resolvedSize = size ?? this.size;
    const runtimeDataset = this.getDataset ? this.getDataset(card, options) : null;
    const computedDataset = {
      ...this.dataset,
      ...(runtimeDataset || {}),
      ...(dataset || {}),
    };
    if (resolvedSkin) {
      computedDataset.skin = resolvedSkin;
    } else if (el.dataset.skin) {
      delete el.dataset.skin;
    }
    if (resolvedSize) {
      computedDataset.size = resolvedSize;
    } else if (el.dataset.size) {
      delete el.dataset.size;
    }
    applyDataset(el, computedDataset);
    applyAttributes(el, attributes);

    const showFace = faceUp ?? (card && card.faceUp);
    const cache = el._cardRenderer || (el._cardRenderer = {});
    if (!card || !showFace) {
      el.classList.add(this.stateClasses.faceDown);
      if (cache.content && cache.content.parentElement === el) {
        el.removeChild(cache.content);
      }
      cache.cardKey = null;
      cache.pipSizeKey = null;
      return el;
    }

    if (cardColor(card.suit) === 'red') {
      el.classList.add(this.stateClasses.red);
    }

    const isFace = card.value >= this.faceValueStart;
    const resolvedScale = isFace ? null : this.resolveScale(options);
    const pipSizeKey = isFace ? null : `${card.value}|${resolvedScale}|${resolvedSize ?? ''}`;
    const classKey = `${this.classes.content}|${this.classes.cornerTop}|${this.classes.cornerBottom}|${this.classes.pips}|${this.classes.pip}|${this.classes.faceLabel}`;
    const cardKey = `${card.value}|${card.suit}`;
    const needsRebuild =
      cache.cardKey !== cardKey ||
      cache.isFace !== isFace ||
      cache.pipSizeKey !== pipSizeKey ||
      cache.faceValueStart !== this.faceValueStart ||
      cache.valueLabels !== this.valueLabels ||
      cache.suitSymbols !== this.suitSymbols ||
      cache.classKey !== classKey;

    let content = cache.content;
    if (!content || content.parentElement !== el) {
      content = document.createElement('div');
      cache.content = content;
      el.appendChild(content);
    }
    if (content.className !== this.classes.content) {
      content.className = this.classes.content;
    }

    if (needsRebuild) {
      while (content.firstChild) content.removeChild(content.firstChild);
      const label = this.formatCardLabel(card);
      content.appendChild(buildCorner(this.classes.cornerTop, label));
      content.appendChild(buildCorner(this.classes.cornerBottom, label));

      if (isFace) {
        const face = document.createElement('div');
        face.className = this.classes.faceLabel;
        face.textContent = this.valueLabels[card.value];
        content.appendChild(face);
      } else {
        const pips = document.createElement('div');
        pips.className = this.classes.pips;
        this.getPipsModifiers(card.value).forEach((cls) => pips.classList.add(cls));

        const layout = this.pipLayout(card.value);
        const sizeClass = this.getPipSizeClass(card.value, { scale: resolvedScale, size: resolvedSize, card });
        const pipSymbol = this.suitSymbols[card.suit];
        const frag = document.createDocumentFragment();
        layout.forEach((cell) => {
          const pip = document.createElement('div');
          pip.className = this.classes.pip;
          if (sizeClass) pip.classList.add(sizeClass);
          const row = Math.floor(cell / 3) + 1;
          const col = (cell % 3) + 1;
          pip.style.gridRow = String(row);
          pip.style.gridColumn = String(col);
          pip.textContent = pipSymbol;
          frag.appendChild(pip);
        });
        pips.appendChild(frag);
        content.appendChild(pips);
      }

      cache.cardKey = cardKey;
      cache.isFace = isFace;
      cache.pipSizeKey = pipSizeKey;
      cache.faceValueStart = this.faceValueStart;
      cache.valueLabels = this.valueLabels;
      cache.suitSymbols = this.suitSymbols;
      cache.classKey = classKey;
    }

    return el;
  }

  createCardElement(card, options = {}) {
    const el = document.createElement('div');
    return this.updateCardElement(el, card, options);
  }
}
