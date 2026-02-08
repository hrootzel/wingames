function resolveElement(value, name) {
  if (!value) throw new Error(`Missing ${name}`);
  if (typeof value === 'string') {
    const el = document.querySelector(value);
    if (!el) throw new Error(`Cannot find element for ${name}: ${value}`);
    return el;
  }
  return value;
}

function computeScale(rawScale, mode) {
  if (!Number.isFinite(rawScale) || rawScale <= 0) return 1;
  if (mode !== 'integer') return rawScale;
  if (rawScale < 1) return rawScale;
  return Math.max(1, Math.floor(rawScale));
}

export function initGameShell(options) {
  const {
    surfaceEl,
    canvasEl,
    baseWidth,
    baseHeight,
    mode = 'fractional',
    fit = 'css',
    pixelated = false,
    onResize,
    context,
  } = options || {};

  const surface = resolveElement(surfaceEl, 'surfaceEl');
  const canvas = resolveElement(canvasEl, 'canvasEl');

  const logicalWidth = Number(baseWidth) || Number(canvas.getAttribute('width')) || canvas.width || 320;
  const logicalHeight = Number(baseHeight) || Number(canvas.getAttribute('height')) || canvas.height || 240;

  if (pixelated) {
    canvas.style.imageRendering = 'pixelated';
  }

  let lastCssW = -1;
  let lastCssH = -1;

  function applyResize() {
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawScale = Math.min(rect.width / logicalWidth, rect.height / logicalHeight);
    const scale = computeScale(rawScale, mode);
    const cssW = Math.max(1, logicalWidth * scale);
    const cssH = Math.max(1, logicalHeight * scale);

    if (Math.abs(cssW - lastCssW) > 0.25 || Math.abs(cssH - lastCssH) > 0.25) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      lastCssW = cssW;
      lastCssH = cssH;
    }

    if (fit === 'backing') {
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.round(cssW * dpr));
      const targetH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      if (context && typeof context.setTransform === 'function') {
        context.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      }
    }

    if (typeof onResize === 'function') {
      onResize({
        cssWidth: cssW,
        cssHeight: cssH,
        logicalWidth,
        logicalHeight,
        scale,
        fit,
      });
    }
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(applyResize)
    : null;

  if (resizeObserver) {
    resizeObserver.observe(surface);
  } else {
    window.addEventListener('resize', applyResize);
  }

  window.addEventListener('orientationchange', applyResize);
  applyResize();
  requestAnimationFrame(() => applyResize());
  setTimeout(() => applyResize(), 0);

  return {
    resize: applyResize,
    destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', applyResize);
      }
      window.removeEventListener('orientationchange', applyResize);
    },
  };
}
