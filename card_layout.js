/**
 * Shared card layout and scaling system for all card games.
 * Handles responsive scaling via ResizeObserver and CSS custom properties.
 */

const DEFAULT_BASE_WIDTH = 88;
const DEFAULT_BASE_HEIGHT = 120;
const DEFAULT_BASE_GAP = 12;
const DEFAULT_BASE_SPACING = 24;

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

function readBaseMetrics(root = document.documentElement) {
  const styles = getComputedStyle(root);
  return {
    baseWidth: parseFloat(styles.getPropertyValue('--card-base-width')) || DEFAULT_BASE_WIDTH,
    baseHeight: parseFloat(styles.getPropertyValue('--card-base-height')) || DEFAULT_BASE_HEIGHT,
    baseGap: parseFloat(styles.getPropertyValue('--card-base-gap')) || DEFAULT_BASE_GAP,
    baseSpacing: parseFloat(styles.getPropertyValue('--card-base-spacing')) || DEFAULT_BASE_SPACING,
  };
}

function readScaledMetrics(root = document.documentElement) {
  const styles = getComputedStyle(root);
  const scale = parseFloat(styles.getPropertyValue('--card-scale')) || 1;
  return {
    scale,
    cardWidth: parseFloat(styles.getPropertyValue('--card-width')) || DEFAULT_BASE_WIDTH * scale,
    cardHeight: parseFloat(styles.getPropertyValue('--card-height')) || DEFAULT_BASE_HEIGHT * scale,
    cardGap: parseFloat(styles.getPropertyValue('--card-gap')) || DEFAULT_BASE_GAP * scale,
    stackSpacing: parseFloat(styles.getPropertyValue('--stack-spacing')) || DEFAULT_BASE_SPACING * scale,
  };
}

function computeScale(constraints, baseMetrics, minScale = 0.6, maxScale = 1) {
  const scales = constraints.map((c) => {
    if (!c) return 1;
    const required = typeof c.required === 'number'
      ? c.required
      : c.columns
        ? c.columns * baseMetrics.baseWidth + (c.columns - 1) * baseMetrics.baseGap
        : 0;
    const available = c.available ?? 0;
    return required > 0 && available > 0 && required > available ? available / required : 1;
  });
  return Math.max(minScale, Math.min(maxScale, ...scales));
}

function applyScale(root, scale) {
  root.style.setProperty('--card-scale', scale.toFixed(3));
}

export class CardLayout {
  constructor(options = {}) {
    this.root = options.root || document.documentElement;
    this.minScale = options.minScale ?? 0.6;
    this.maxScale = options.maxScale ?? 1;
    this.debounceMs = options.debounceMs ?? 100;
    this._constraints = [];
    this._observers = [];
    this._onUpdate = null;
    this._resizeHandler = debounce(() => this._update(), this.debounceMs);
  }

  get metrics() {
    return readScaledMetrics(this.root);
  }

  get baseMetrics() {
    return readBaseMetrics(this.root);
  }

  get scale() {
    return parseFloat(getComputedStyle(this.root).getPropertyValue('--card-scale')) || 1;
  }

  /**
   * Initialize layout with constraints and optional callback.
   * @param {Object} options
   * @param {Array} options.constraints - Array of { columns, available } or { required, available }
   * @param {HTMLElement[]} options.observeElements - Elements to watch for resize
   * @param {Function} options.onUpdate - Called after scale update
   */
  init(options = {}) {
    this._constraints = options.constraints || [];
    this._onUpdate = options.onUpdate || null;

    // Clean up existing observers
    this.destroy();

    // Set up ResizeObserver for specified elements
    const elements = options.observeElements || [];
    if (elements.length && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(this._resizeHandler);
      elements.forEach((el) => el && ro.observe(el));
      this._observers.push(ro);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', this._resizeHandler);

    // Initial update
    this._update();
    return this;
  }

  /**
   * Update constraints dynamically (e.g., when layout changes).
   */
  setConstraints(constraints) {
    this._constraints = constraints;
    this._update();
  }

  /**
   * Force a scale recalculation.
   */
  refresh() {
    this._update();
  }

  _update() {
    const base = this.baseMetrics;
    // Re-read available widths from constraint elements
    const constraints = this._constraints.map((c) => {
      if (c.element) {
        return { ...c, available: c.element.clientWidth };
      }
      return c;
    });
    const scale = computeScale(constraints, base, this.minScale, this.maxScale);
    applyScale(this.root, scale);
    if (this._onUpdate) this._onUpdate(this.metrics);
  }

  destroy() {
    this._observers.forEach((ro) => ro.disconnect());
    this._observers = [];
    window.removeEventListener('resize', this._resizeHandler);
  }
}

/**
 * Calculate dynamic stack spacing based on available height.
 */
export function calcStackSpacing(options = {}) {
  const {
    stackLength,
    containerTop,
    viewportHeight = window.innerHeight,
    cardHeight,
    baseSpacing,
    minSpacing = 8,
    bottomMargin = 28,
    tightenStart = 10,
    tightenEnd = 24,
  } = options;

  if (stackLength <= 1) return baseSpacing;

  const availableHeight = Math.max(0, viewportHeight - containerTop - bottomMargin);
  const fitSpacing = (availableHeight - cardHeight) / (stackLength - 1);

  const t = stackLength <= tightenStart
    ? 0
    : Math.min(1, (stackLength - tightenStart) / (tightenEnd - tightenStart));
  const desiredSpacing = baseSpacing - t * (baseSpacing - minSpacing);

  return Math.max(0, Math.min(baseSpacing, desiredSpacing, fitSpacing));
}

/**
 * Shared drag preview cache management.
 */
export function createDragPreviewCache() {
  return { el: null, cards: [] };
}

export function getDragPreviewElement(cache) {
  if (!cache.el) {
    const wrap = document.createElement('div');
    wrap.className = 'drag-preview';
    wrap.style.display = 'none';
    wrap.style.willChange = 'transform';
    document.body.appendChild(wrap);
    cache.el = wrap;
  } else if (!cache.el.parentElement) {
    document.body.appendChild(cache.el);
  }
  return cache.el;
}

export function hideDragPreview(cache) {
  if (!cache.el) return;
  cache.el.style.display = 'none';
  cache.el.style.transform = 'translate(-9999px, -9999px)';
}

export function showDragPreview(cache, x, y) {
  if (!cache.el) return;
  cache.el.style.display = '';
  cache.el.style.transform = `translate(${x}px, ${y}px)`;
}
