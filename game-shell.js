/**
 * Game Shell - Responsive layout system for arcade games
 * 
 * See game-shell-example.html and game-shell-example.css for a minimal
 * working integration with annotated comments.
 * 
 * USAGE:
 * 
 * 1. HTML Structure:
 *    <div class="your-game gs-shell">
 *      <div class="your-stage gs-stage">
 *        <div class="gs-surface">
 *          <canvas id="canvas" width="640" height="480"></canvas>
 *        </div>
 *      </div>
 *      <div class="gs-hud">
 *        <div class="panel-box" data-gs-snap="top" data-gs-fit="required">
 *          <!-- HUD content -->
 *        </div>
 *      </div>
 *    </div>
 * 
 *    Note: gs-stage wrapper is auto-created if missing.
 *    surfaceEl is auto-detected as .gs-surface inside the shell if not provided.
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

  const canvas = resolveElement(canvasEl, 'canvasEl');
  const shellRaw = resolveOptionalElement(shellEl) || canvas.closest('.gs-shell');
  // Auto-detect surface: explicit option, or .gs-surface in shell, or canvas parent
  const surface = resolveOptionalElement(surfaceEl)
    || (shellRaw ? shellRaw.querySelector('.gs-surface') : null)
    || canvas.parentElement;
  if (!surface) throw new Error('Cannot find surface element');
  const shell = shellRaw || surface.closest('.gs-shell');
  const hud = resolveOptionalElement(hudEl) || (shell ? shell.querySelector('.gs-hud') : null);
  const fitHost = resolveOptionalElement(fitHostEl) || shell || surface.parentElement || surface;

  // Auto-wrap surface in gs-stage if missing
  if (shell && !surface.closest('.gs-stage')) {
    const stage = document.createElement('div');
    stage.className = 'gs-stage';
    surface.parentNode.insertBefore(stage, surface);
    stage.appendChild(surface);
  }

  // Warn on conflicting shell styles
  if (shell) {
    const shellStyle = getComputedStyle(shell);
    if (shellStyle.display === 'flex') {
      console.warn('[game-shell] Shell has display:flex which conflicts with game-shell grid layout. Remove it from your game CSS.');
    }
  }

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

  function getRequiredHudHeight() {
    if (!shell) return 120;
    let h = 0;
    const topLane = shell.querySelector('.gs-snap-top');
    if (topLane && topLane.children.length) {
      h += topLane.getBoundingClientRect().height;
    } else {
      const panels = shell.querySelectorAll('[data-gs-fit="required"]');
      for (const p of panels) h += p.getBoundingClientRect().height;
    }
    const gap = parseFloat(getComputedStyle(shell).getPropertyValue('--gs-gap')) || 12;
    return h + gap * 2;
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
    const aspect = logicalW / logicalH;
    const autoBias = aspect > 1.05 ? 'wide' : aspect < 0.95 ? 'tall' : 'square';
    const bias = (canvasBias === 'wide' || canvasBias === 'tall') ? canvasBias : autoBias;

    // Side layout: canvas gets (availW - hudW - gap) x availH
    const sideCanvasW = Math.max(0, availW - hudW - gap);
    const sideScale = computeScale(Math.min(sideCanvasW / logicalW, availH / logicalH), mode);

    // Side layout with compressed HUD: canvas gets (availW - hudMinWidth - gap) x availH
    const sideCanvasWMin = Math.max(0, availW - hudMinWidth - gap);
    const sideScaleMax = computeScale(Math.min(sideCanvasWMin / logicalW, availH / logicalH), mode);

    // Stack layout: canvas gets full availW, reserve ~25% for HUD (refined after snap layout)
    const hudReserve = Math.max(120, availH * 0.25);
    const stackAvailH = Math.max(1, availH - hudReserve);
    const stackScale = computeScale(Math.min(availW / logicalW, stackAvailH / logicalH), mode);

    // The effective side scale is the best we can get (possibly by shrinking HUD)
    const bestSideScale = Math.max(sideScale, sideScaleMax);

    // Pick whichever gives a bigger canvas, with a small bias toward the "natural" layout
    // For tall canvases, prefer side (sidebar). For wide canvases, prefer stack (top/bottom).
    // Square canvases use neutral threshold — no layout preference.
    const biasThreshold = bias === 'tall' ? 0.92 : bias === 'wide' ? 1.05 : 1.0;
    const useSide = bestSideScale >= stackScale * biasThreshold && sideCanvasW >= logicalW * 0.2;

    // Compute the actual HUD scale if we use side layout
    let hudScale = 1;
    if (useSide && hudW > 0) {
      const canvasPixelW = logicalW * bestSideScale;
      const remaining = availW - canvasPixelW - gap;
      hudScale = Math.max(0.5, Math.min(1, remaining / hudW));
    }

    // If HUD would be squeezed below --gs-hud-min-pct of shell width, bail to stack
    const hudMinPct = shell ? (parseFloat(getComputedStyle(shell).getPropertyValue('--gs-hud-min-pct')) || 20) : 20;
    const effectiveHudW = hudW * hudScale;
    const forceStack = useSide && hudScale < 1 && effectiveHudW < availW * (hudMinPct / 100);

    return { useSide: useSide && !forceStack, sideScale: bestSideScale, stackScale, hudScale, hudW };
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
    // Use the lesser of visual position and a small cap so the header/status bar
    // above the shell doesn't over-shrink the canvas. Content above the shell
    // scrolls away during play, so we only reserve minimal space for it.
    const topInset = ignoreHeaderInFit ? 0 : Math.min(shellTop, viewportH * 0.08);
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
    if (hud) {
      hud.style.removeProperty('zoom'); hud.style.removeProperty('transform');
      for (const el of hud.querySelectorAll('[data-gs-no-zoom]')) el.style.removeProperty('zoom');
    }
    if (shell) shell.style.removeProperty('--gs-hud-width-live');

    let scale, cssW, cssH;

    if (useSide) {
      // Apply HUD scaling
      if (hud && Math.abs(hudScale - 1) > 0.001) {
        hud.style.zoom = hudScale.toFixed(3);
        // Counter-scale elements that shouldn't shrink (e.g. preview canvases)
        for (const el of hud.querySelectorAll('[data-gs-no-zoom]')) {
          el.style.zoom = (1 / hudScale).toFixed(3);
        }
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
      // Stack: canvas takes full width, reserve space only for required HUD panels
      if (shell) shell.style.removeProperty('--gs-hud-width-live');
      
      const hudReserve = Math.max(120, getRequiredHudHeight());
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
  requestAnimationFrame(() => {
    applyResize();
    // Auto-scroll the shell into view so the header scrolls away,
    // giving the canvas maximum space from the start.
    if (shell && shell.getBoundingClientRect().top > 0) {
      shell.scrollIntoView({ block: 'start', behavior: 'instant' });
      applyResize();
    }
  });

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
