/**
 * Game Shell - Responsive layout system for arcade games
 * 
 * USAGE:
 * 
 * 1. HTML Structure:
 *    <div class="your-game gs-shell">
 *      <div class="gs-surface">
 *        <canvas id="canvas" width="640" height="480"></canvas>
 *      </div>
 *      <div class="gs-hud">
 *        <div class="panel-box" data-gs-snap="top" data-gs-fit="required">
 *          <!-- HUD content -->
 *        </div>
 *      </div>
 *    </div>
 * 
 * 2. Initialize:
 *    initGameShell({
 *      shellEl: '.your-game',      // Required: container with gs-shell class
 *      canvasEl: canvas,            // Required: canvas element or selector
 *      baseWidth: 640,              // Required: logical canvas width
 *      baseHeight: 480,             // Required: logical canvas height
 *      mode: 'fractional',          // Optional: 'fractional' or 'integer' scaling
 *      fit: 'css',                  // Optional: 'css' or 'logical'
 *      onResize: callback           // Optional: called after resize
 *    });
 * 
 * 3. Layout Behavior:
 *    - Automatically switches between side (HUD beside canvas) and stack (HUD below)
 *    - Wide canvases (aspect > 1.05) prefer stack layout
 *    - Tall canvases (aspect < 1.05) prefer side layout
 *    - HUD compresses (zoom 0.5-1.0) in side layout when needed
 *    - Stack layout reserves 40% height (min 250px) for HUD
 */

function resolveElement(value, name) {
  if (!value) throw new Error(`Missing ${name}`);
  if (typeof value === 'string') {
    const el = document.querySelector(value);
    if (!el) throw new Error(`Cannot find element for ${name}: ${value}`);
    return el;
  }
  return value;
}

function resolveOptionalElement(value) {
  if (!value) return null;
  return typeof value === 'string' ? document.querySelector(value) : value;
}

function computeScale(rawScale, mode) {
  if (!Number.isFinite(rawScale) || rawScale <= 0) return 1;
  if (mode !== 'integer') return rawScale;
  if (rawScale < 1) return rawScale;
  return Math.max(1, Math.floor(rawScale));
}

export function initGameShell(options) {
  const {
    shellEl,
    hudEl,
    fitHostEl,
    surfaceEl,
    canvasEl,
    baseWidth,
    baseHeight,
    mode = 'fractional',
    fit = 'css',
    pixelated = false,
    viewportPadding = 12,
    hudMinWidth = 140,
    canvasBias = 'auto',
    ignoreHeaderInFit = false,
    onResize,
    context,
  } = options || {};

  const surface = resolveElement(surfaceEl, 'surfaceEl');
  const canvas = resolveElement(canvasEl, 'canvasEl');
  const shell = resolveOptionalElement(shellEl) || surface.closest('.gs-shell');
  const hud = resolveOptionalElement(hudEl) || (shell ? shell.querySelector('.gs-hud') : null);
  const fitHost = resolveOptionalElement(fitHostEl) || shell || surface.parentElement || surface;

  const logicalW = Number(baseWidth) || Number(canvas.getAttribute('width')) || canvas.width || 320;
  const logicalH = Number(baseHeight) || Number(canvas.getAttribute('height')) || canvas.height || 240;

  surface.dataset.gsManaged = 'true';
  canvas.dataset.gsManaged = 'true';
  canvas.style.transformOrigin = 'top left';
  surface.style.overflow = 'hidden';
  if (pixelated) canvas.style.imageRendering = 'pixelated';

  // Create snap lanes
  const snapTop = document.createElement('div');
  const snapBottom = document.createElement('div');
  snapTop.className = 'gs-snap-lane gs-snap-top';
  snapBottom.className = 'gs-snap-lane gs-snap-bottom';

  const hudChildren = hud ? Array.from(hud.children) : [];
  hudChildren.forEach((c, i) => { c.dataset.gsHudOrder = String(i); });

  if (shell) {
    if (!shell.querySelector('.gs-snap-top')) shell.appendChild(snapTop);
    if (!shell.querySelector('.gs-snap-bottom')) shell.appendChild(snapBottom);
  }

  function listHudNodesInOrder() {
    return hudChildren
      .filter(n => n && n.isConnected)
      .sort((a, b) => Number(a.dataset.gsHudOrder || 0) - Number(b.dataset.gsHudOrder || 0));
  }

  function applySnapLayout(isPortrait) {
    if (!shell || !hud) return;
    const topLane = shell.querySelector('.gs-snap-top');
    const bottomLane = shell.querySelector('.gs-snap-bottom');
    if (!topLane || !bottomLane) return;

    const nodes = listHudNodesInOrder();
    if (!isPortrait) {
      for (const node of nodes) hud.appendChild(node);
      shell.dataset.gsMode = 'landscape';
      shell.dataset.gsTopActive = 'false';
      shell.dataset.gsBottomActive = 'false';
      return;
    }

    for (const node of nodes) {
      const snap = (node.dataset.gsSnap || '').toLowerCase();
      if (snap === 'top') topLane.appendChild(node);
      else if (snap === 'bottom') bottomLane.appendChild(node);
      else hud.appendChild(node);
    }
    shell.dataset.gsMode = 'portrait';
    shell.dataset.gsTopActive = String(topLane.children.length > 0);
    shell.dataset.gsBottomActive = String(bottomLane.children.length > 0);
  }

  // Read the HUD's configured width from the CSS variable
  function getHudNaturalWidth() {
    if (!shell) return 200;
    const style = getComputedStyle(shell);
    const val = style.getPropertyValue('--gs-hud-width').trim();
    if (!val) return 200;
    // Temporarily create an element to resolve clamp/calc values
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:${val}`;
    shell.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w || 200;
  }

  // Pure geometry: compute canvas scale for side layout vs stack layout
  function pickLayout(availW, availH, gap) {
    const hudW = getHudNaturalWidth();
    const autoBias = logicalW > logicalH * 1.05 ? 'wide' : 'tall';
    const bias = (canvasBias === 'wide' || canvasBias === 'tall') ? canvasBias : autoBias;

    // Side layout: canvas gets (availW - hudW - gap) x availH
    const sideCanvasW = Math.max(0, availW - hudW - gap);
    const sideScale = computeScale(Math.min(sideCanvasW / logicalW, availH / logicalH), mode);

    // Side layout with compressed HUD: canvas gets (availW - hudMinWidth - gap) x availH
    const sideCanvasWMin = Math.max(0, availW - hudMinWidth - gap);
    const sideScaleMax = computeScale(Math.min(sideCanvasWMin / logicalW, availH / logicalH), mode);

    // Stack layout: canvas gets full availW, but reserve space for HUD below
    const hudReserve = Math.max(250, availH * 0.4);
    const stackAvailH = Math.max(1, availH - hudReserve);
    const stackScale = computeScale(Math.min(availW / logicalW, stackAvailH / logicalH), mode);

    // The effective side scale is the best we can get (possibly by shrinking HUD)
    const bestSideScale = Math.max(sideScale, sideScaleMax);

    // Pick whichever gives a bigger canvas, with a small bias toward the "natural" layout
    // For tall canvases, prefer side (sidebar). For wide canvases, prefer stack (top/bottom).
    const biasThreshold = bias === 'tall' ? 0.92 : 1.05;
    const useSide = bestSideScale >= stackScale * biasThreshold && sideCanvasW >= logicalW * 0.2;

    // Compute the actual HUD scale if we use side layout
    let hudScale = 1;
    if (useSide && hudW > 0) {
      const canvasPixelW = logicalW * bestSideScale;
      const remaining = availW - canvasPixelW - gap;
      hudScale = Math.max(0.5, Math.min(1, remaining / hudW));
    }

    return { useSide, sideScale: bestSideScale, stackScale, hudScale, hudW };
  }

  let lastCssW = -1;
  let lastCssH = -1;
  let rafId = 0;

  function applyResize() {
    const hostRect = fitHost.getBoundingClientRect();
    if (hostRect.width <= 0) return;

    const viewport = window.visualViewport;
    const viewportH = viewport?.height || window.innerHeight || hostRect.height;
    const shellTop = shell ? Math.max(0, shell.getBoundingClientRect().top) : Math.max(0, hostRect.top);
    const topInset = ignoreHeaderInFit ? 0 : shellTop;
    const availW = hostRect.width;
    const availH = Math.max(1, viewportH - topInset - viewportPadding);

    const shellStyle = shell ? getComputedStyle(shell) : null;
    const gap = shellStyle ? (parseFloat(shellStyle.columnGap || shellStyle.gap || '0') || 0) : 0;

    const { useSide, hudScale, hudW } = pickLayout(availW, availH, gap);
    const isStack = !useSide;

    // Apply layout mode
    if (shell) {
      shell.dataset.gsLayout = useSide ? 'side' : 'stack';
    }
    applySnapLayout(isStack);

    // Reset lane/hud scaling
    const topLane = shell ? shell.querySelector('.gs-snap-top') : null;
    const bottomLane = shell ? shell.querySelector('.gs-snap-bottom') : null;
    if (topLane) topLane.style.removeProperty('zoom');
    if (bottomLane) bottomLane.style.removeProperty('zoom');
    if (hud) { hud.style.removeProperty('zoom'); hud.style.removeProperty('transform'); }
    if (shell) shell.style.removeProperty('--gs-hud-width-live');

    let scale, cssW, cssH;

    if (useSide) {
      // Apply HUD scaling
      if (hud && Math.abs(hudScale - 1) > 0.001) {
        hud.style.zoom = hudScale.toFixed(3);
      }
      if (shell && hudW > 0) {
        shell.style.setProperty('--gs-hud-width-live', `${Math.max(hudMinWidth, hudW * hudScale)}px`);
      }
      const canvasBudgetW = Math.max(1, availW - Math.max(hudMinWidth, hudW * hudScale) - gap);
      const rawScale = Math.min(canvasBudgetW / logicalW, availH / logicalH);
      scale = computeScale(rawScale, mode);
      cssW = Math.max(1, logicalW * scale);
      cssH = Math.max(1, logicalH * scale);
    } else {
      // Stack: canvas takes full width, but reserve space for HUD below
      if (shell) shell.style.removeProperty('--gs-hud-width-live');
      
      // Reserve approximately 40% of height for HUD in stack mode, or minimum 250px
      const hudReserve = Math.max(250, availH * 0.4);
      const canvasAvailH = Math.max(1, availH - hudReserve);
      
      const rawScale = Math.min(availW / logicalW, canvasAvailH / logicalH);
      scale = computeScale(rawScale, mode);
      cssW = Math.max(1, logicalW * scale);
      cssH = Math.max(1, logicalH * scale);
    }

    // Size the surface and canvas
    surface.style.width = `${cssW}px`;
    surface.style.height = `${cssH}px`;
    surface.style.maxWidth = '100%';
    surface.style.maxHeight = '100%';

    if (Math.abs(cssW - lastCssW) > 0.25 || Math.abs(cssH - lastCssH) > 0.25) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      lastCssW = cssW;
      lastCssH = cssH;
    }

    // Update backing store if requested
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
        logicalWidth: logicalW,
        logicalHeight: logicalH,
        scale,
        portrait: isStack,
        fit,
      });
    }
  }

  // Debounced resize to avoid oscillation
  function scheduleResize() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyResize();
    });
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(scheduleResize)
    : null;
  const vp = typeof window !== 'undefined' ? window.visualViewport : null;
  let dprMql = null;

  if (resizeObserver) {
    resizeObserver.observe(surface);
    resizeObserver.observe(fitHost);
    if (shell) resizeObserver.observe(shell);
  } else {
    window.addEventListener('resize', scheduleResize);
  }

  window.addEventListener('orientationchange', scheduleResize);
  if (vp) {
    vp.addEventListener('resize', scheduleResize);
  }

  function bindDprListener() {
    if (!window.matchMedia) return;
    if (dprMql) dprMql.removeEventListener('change', handleDprChange);
    dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprMql.addEventListener('change', handleDprChange);
  }

  function handleDprChange() {
    bindDprListener();
    scheduleResize();
  }

  bindDprListener();
  applyResize();
  requestAnimationFrame(() => applyResize());

  return {
    resize: applyResize,
    destroy() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', scheduleResize);
      }
      window.removeEventListener('orientationchange', scheduleResize);
      if (vp) vp.removeEventListener('resize', scheduleResize);
      if (dprMql) dprMql.removeEventListener('change', handleDprChange);
      if (shell) {
        shell.style.removeProperty('--gs-hud-width-live');
        const tl = shell.querySelector('.gs-snap-top');
        const bl = shell.querySelector('.gs-snap-bottom');
        if (tl) tl.style.removeProperty('zoom');
        if (bl) bl.style.removeProperty('zoom');
      }
      if (hud) { hud.style.removeProperty('zoom'); hud.style.removeProperty('transform'); }
      if (surface) { surface.style.removeProperty('width'); surface.style.removeProperty('height'); }
    },
  };
}
