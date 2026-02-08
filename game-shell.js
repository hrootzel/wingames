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

function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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
    layoutBreakpoint = 760,
    viewportPadding = 12,
    topLaneMaxViewportFraction = 0.24,
    bottomLaneMaxViewportFraction = 0.24,
    minLaneScale = 0.6,
    sideHudMinScale = 0.58,
    sideScaleTolerance = 0.72,
    sideHudPreferredMinScale = 0.72,
    forceStackBelowWidth = 560,
    ignoreHeaderInFit = false,
    onResize,
    context,
  } = options || {};

  const surface = resolveElement(surfaceEl, 'surfaceEl');
  const canvas = resolveElement(canvasEl, 'canvasEl');
  const shell = resolveOptionalElement(shellEl) || surface.closest('.gs-shell');
  const hud = resolveOptionalElement(hudEl) || (shell ? shell.querySelector('.gs-hud') : null);
  const fitHost = resolveOptionalElement(fitHostEl) || shell || surface.parentElement || surface;

  const logicalWidth = Number(baseWidth) || Number(canvas.getAttribute('width')) || canvas.width || 320;
  const logicalHeight = Number(baseHeight) || Number(canvas.getAttribute('height')) || canvas.height || 240;
  surface.dataset.gsManaged = 'true';
  canvas.dataset.gsManaged = 'true';
  canvas.style.transformOrigin = 'top left';
  surface.style.overflow = 'hidden';
  if (shell) {
    shell.dataset.gsShell = 'true';
  }

  if (pixelated) {
    canvas.style.imageRendering = 'pixelated';
  }

  const snapTop = document.createElement('div');
  const snapBottom = document.createElement('div');
  snapTop.className = 'gs-snap-lane gs-snap-top';
  snapBottom.className = 'gs-snap-lane gs-snap-bottom';

  const hudChildren = hud ? Array.from(hud.children) : [];
  for (let i = 0; i < hudChildren.length; i += 1) {
    hudChildren[i].dataset.gsHudOrder = String(i);
  }

  if (shell) {
    if (!shell.querySelector('.gs-snap-top')) {
      shell.appendChild(snapTop);
    }
    if (!shell.querySelector('.gs-snap-bottom')) {
      shell.appendChild(snapBottom);
    }
  }

  function listHudNodesInOrder() {
    return hudChildren
      .filter((node) => node && node.isConnected)
      .sort((a, b) => Number(a.dataset.gsHudOrder || 0) - Number(b.dataset.gsHudOrder || 0));
  }

  function applySnapLayout(isPortrait) {
    if (!shell || !hud) return;
    const topLane = shell.querySelector('.gs-snap-top');
    const bottomLane = shell.querySelector('.gs-snap-bottom');
    if (!topLane || !bottomLane) return;

    const nodes = listHudNodesInOrder();
    if (!isPortrait) {
      for (const node of nodes) {
        hud.appendChild(node);
      }
      shell.dataset.gsMode = 'landscape';
      shell.dataset.gsTopActive = 'false';
      shell.dataset.gsBottomActive = 'false';
      return;
    }

    for (const node of nodes) {
      const snap = (node.dataset.gsSnap || '').toLowerCase();
      if (snap === 'top') {
        topLane.appendChild(node);
      } else if (snap === 'bottom') {
        bottomLane.appendChild(node);
      } else {
        hud.appendChild(node);
      }
    }
    shell.dataset.gsMode = 'portrait';
    shell.dataset.gsTopActive = String(topLane.children.length > 0);
    shell.dataset.gsBottomActive = String(bottomLane.children.length > 0);
  }

  function applyLaneScale(laneEl, scale, cssVarName) {
    if (!shell || !laneEl) return;
    const clamped = Math.max(0.5, Math.min(1, scale));
    if (Math.abs(clamped - 1) < 0.001) {
      laneEl.style.removeProperty('zoom');
    } else {
      laneEl.style.zoom = clamped.toFixed(3);
    }
    if (cssVarName) {
      shell.style.setProperty(cssVarName, clamped.toFixed(3));
    }
  }

  function applyHudScale(scale) {
    if (!shell || !hud) return;
    const clamped = Math.max(0.5, Math.min(1, scale));
    const supportsZoom = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');
    if (supportsZoom) {
      if (Math.abs(clamped - 1) < 0.001) {
        hud.style.removeProperty('zoom');
      } else {
        hud.style.zoom = clamped.toFixed(3);
      }
      hud.style.removeProperty('transform');
    } else {
      hud.style.removeProperty('zoom');
      if (Math.abs(clamped - 1) < 0.001) {
        hud.style.removeProperty('transform');
      } else {
        hud.style.transformOrigin = 'top left';
        hud.style.transform = `scale(${clamped.toFixed(3)})`;
      }
    }
    shell.style.setProperty('--gs-side-hud-scale', clamped.toFixed(3));
  }

  function requiredContainerHeight(el) {
    if (!el || !isVisible(el)) return 0;
    const requiredChildren = Array.from(el.children || []).filter(
      (child) => child.dataset && child.dataset.gsFit === 'required' && isVisible(child),
    );
    if (requiredChildren.length === 0) return 0;

    let sum = 0;
    for (const child of requiredChildren) {
      sum += child.getBoundingClientRect().height;
    }

    const style = window.getComputedStyle(el);
    const gap = parseFloat(style.rowGap || style.gap || '0') || 0;
    if (requiredChildren.length > 1) {
      sum += gap * (requiredChildren.length - 1);
    }
    return sum;
  }

  function applyLayoutMode(useSideLayout) {
    if (!shell) return;
    if (useSideLayout) {
      shell.dataset.gsLayout = 'side';
      return;
    }
    shell.dataset.gsLayout = 'stack';
  }

  function shouldUseSideLayout(hostRect) {
    if (!shell || !hud) return true;
    const viewport = window.visualViewport;
    const viewportW = viewport?.width || window.innerWidth || hostRect.width || 1;
    const viewportH = viewport?.height || window.innerHeight || hostRect.height || 1;
    if (viewportW <= forceStackBelowWidth) return false;
    const shellTop = Math.max(0, shell.getBoundingClientRect().top);
    const topInset = ignoreHeaderInFit ? 0 : shellTop;
    const fullHeightBudget = Math.max(1, viewportH - topInset - viewportPadding);

    applyLayoutMode(true);
    applySnapLayout(false);

    const shellRect = shell.getBoundingClientRect();
    const hudRect = hud.getBoundingClientRect();
    const shellStyle = window.getComputedStyle(shell);
    const colGap = parseFloat(shellStyle.columnGap || shellStyle.gap || '0') || 0;
    const sideCanvasW = Math.max(1, shellRect.width - hudRect.width - colGap);
    const sideScale = computeScale(Math.min(sideCanvasW / logicalWidth, fullHeightBudget / logicalHeight), mode);
    const sideCanvasWAtMinHud = Math.max(1, shellRect.width - hudRect.width * sideHudMinScale - colGap);
    const sideScaleBest = computeScale(
      Math.min(sideCanvasWAtMinHud / logicalWidth, fullHeightBudget / logicalHeight),
      mode,
    );
    const desiredCanvasW = logicalWidth * (fullHeightBudget / logicalHeight);
    const remainingForHudAtDesiredCanvas = shellRect.width - desiredCanvasW - colGap;
    const hudScaleNeeded = hudRect.width > 0
      ? Math.min(1, Math.max(0, remainingForHudAtDesiredCanvas / hudRect.width))
      : 1;
    const stackScale = computeScale(Math.min(shellRect.width / logicalWidth, fullHeightBudget / logicalHeight), mode);
    const requiredHudH = requiredContainerHeight(hud);

    const sideFitsHud = requiredHudH * sideHudMinScale <= fullHeightBudget + 1;
    const sideScaleOk = Math.max(sideScale, sideScaleBest) >= stackScale * sideScaleTolerance;
    const sideHudScaleOk = hudScaleNeeded >= sideHudPreferredMinScale;
    const sideWidthOk = sideCanvasW > logicalWidth * 0.35;
    return sideFitsHud && sideScaleOk && sideHudScaleOk && sideWidthOk;
  }

  let lastCssW = -1;
  let lastCssH = -1;

  function applyResize(forceStack = false) {
    const hostRect = fitHost.getBoundingClientRect();
    if (hostRect.width <= 0) return;

    const sidePreferred = forceStack ? false : shouldUseSideLayout(hostRect);
    applyLayoutMode(sidePreferred);
    const portraitLike = !sidePreferred;
    applySnapLayout(portraitLike);

    let cssW = 1;
    let cssH = 1;
    let scale = 1;
    let topScale = 1;
    let bottomScale = 1;
    const topLane = shell ? shell.querySelector('.gs-snap-top') : null;
    const bottomLane = shell ? shell.querySelector('.gs-snap-bottom') : null;

    const viewport = window.visualViewport;
    const viewportH = viewport?.height || window.innerHeight || hostRect.height || 1;
    const shellTop = shell ? Math.max(0, shell.getBoundingClientRect().top) : Math.max(0, hostRect.top);
    const topInset = ignoreHeaderInFit ? 0 : shellTop;
    const availableW = hostRect.width;
    const fullHeightBudget = Math.max(1, viewportH - topInset - viewportPadding);
    const shellStyle = shell ? window.getComputedStyle(shell) : null;
    const colGap = shellStyle ? parseFloat(shellStyle.columnGap || shellStyle.gap || '0') || 0 : 0;

    // Reset lane scaling before measuring natural heights.
    applyLaneScale(topLane, 1, '--gs-top-scale');
    applyLaneScale(bottomLane, 1, '--gs-bottom-scale');
    applyHudScale(1);
    if (shell) shell.style.removeProperty('--gs-hud-width-live');

    if (!portraitLike) {
      // Side layout: shrink HUD first, then reduce canvas only if still needed.
      const maxCanvasByHeight = fullHeightBudget / logicalHeight;
      const desiredCanvasW = logicalWidth * maxCanvasByHeight;
      const hudRequiredH = requiredContainerHeight(hud);
      const hudNaturalW = hud ? hud.getBoundingClientRect().width : 0;
      let hudScale = 1;

      if (hudNaturalW > 0) {
        const remainingForHudAtMaxCanvas = availableW - desiredCanvasW - colGap;
        if (remainingForHudAtMaxCanvas > 0 && remainingForHudAtMaxCanvas < hudNaturalW) {
          hudScale = Math.max(sideHudMinScale, Math.min(1, remainingForHudAtMaxCanvas / hudNaturalW));
        }
      }
      if (hudRequiredH > 0) {
        const heightScale = Math.max(sideHudMinScale, Math.min(1, fullHeightBudget / hudRequiredH));
        hudScale = Math.min(hudScale, heightScale);
      }
      applyHudScale(hudScale);
      if (shell && hudNaturalW > 0) {
        const liveHudWidth = Math.max(120, hudNaturalW * hudScale);
        shell.style.setProperty('--gs-hud-width-live', `${liveHudWidth}px`);
      }

      const hudScaledW = hudNaturalW * hudScale;
      const canvasWBudget = Math.max(1, availableW - hudScaledW - colGap);
      const fullRawScale = Math.min(canvasWBudget / logicalWidth, maxCanvasByHeight);
      scale = computeScale(fullRawScale, mode);
      cssW = Math.max(1, logicalWidth * scale);
      cssH = Math.max(1, logicalHeight * scale);
      topScale = 1;
      bottomScale = 1;
    } else {
      // Stack layout: canvas-first fit (ignore bars initially), then compact bars.
      if (shell) shell.style.removeProperty('--gs-hud-width-live');
      const fullRawScale = Math.min(availableW / logicalWidth, fullHeightBudget / logicalHeight);
      scale = computeScale(fullRawScale, mode);
      cssW = Math.max(1, logicalWidth * scale);
      cssH = Math.max(1, logicalHeight * scale);

      // 2) Carve out space for required bars after sizing canvas.
      const topRequired = requiredContainerHeight(topLane);
      const bottomRequired = requiredContainerHeight(bottomLane);
      const hudRequired = requiredContainerHeight(hud);

      const topCapScale = topRequired > 0
        ? Math.min(1, (fullHeightBudget * topLaneMaxViewportFraction) / topRequired)
        : 1;
      const bottomCapScale = bottomRequired > 0
        ? Math.min(1, (fullHeightBudget * bottomLaneMaxViewportFraction) / bottomRequired)
        : 1;
      let hudScale = 1;
      topScale = topCapScale;
      bottomScale = bottomCapScale;

      const remainingAfterCanvas = Math.max(0, fullHeightBudget - cssH);
      let scaledRequiredHeight = topRequired * topScale + bottomRequired * bottomScale + hudRequired * hudScale;

      if (scaledRequiredHeight > remainingAfterCanvas && scaledRequiredHeight > 0) {
        const compress = remainingAfterCanvas / scaledRequiredHeight;
        topScale = Math.max(minLaneScale, topScale * compress);
        bottomScale = Math.max(minLaneScale, bottomScale * compress);
        hudScale = Math.max(minLaneScale, hudScale * compress);
        scaledRequiredHeight = topRequired * topScale + bottomRequired * bottomScale + hudRequired * hudScale;
      }

      if (scaledRequiredHeight > remainingAfterCanvas) {
        const targetCanvasH = Math.max(1, fullHeightBudget - scaledRequiredHeight);
        const rawScale = Math.min(availableW / logicalWidth, targetCanvasH / logicalHeight);
        scale = computeScale(rawScale, mode);
        cssW = Math.max(1, logicalWidth * scale);
        cssH = Math.max(1, logicalHeight * scale);

        const remaining2 = Math.max(0, fullHeightBudget - cssH);
        if (scaledRequiredHeight > remaining2 && scaledRequiredHeight > 0) {
          const compress2 = remaining2 / scaledRequiredHeight;
          topScale = Math.max(0.5, topScale * compress2);
          bottomScale = Math.max(0.5, bottomScale * compress2);
        }
      }
    }

    applyLaneScale(topLane, topScale, '--gs-top-scale');
    applyLaneScale(bottomLane, bottomScale, '--gs-bottom-scale');

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

    if (!portraitLike && !forceStack && shell) {
      const viewportNow = window.visualViewport;
      const viewportHNow = viewportNow?.height || window.innerHeight || 0;
      const shellBottom = shell.getBoundingClientRect().bottom;
      if (shellBottom > viewportHNow + 2) {
        applyResize(true);
        return;
      }
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
        topScale,
        bottomScale,
        sideHudScale: hud ? Number((hud.style.zoom || '1')) : 1,
        portrait: portraitLike,
        fit,
      });
    }
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(applyResize)
    : null;
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
  let dprMql = null;

  if (resizeObserver) {
    resizeObserver.observe(surface);
    resizeObserver.observe(fitHost);
    if (shell) resizeObserver.observe(shell);
    if (hud) resizeObserver.observe(hud);
    const topLane = shell ? shell.querySelector('.gs-snap-top') : null;
    const bottomLane = shell ? shell.querySelector('.gs-snap-bottom') : null;
    if (topLane) resizeObserver.observe(topLane);
    if (bottomLane) resizeObserver.observe(bottomLane);
  } else {
    window.addEventListener('resize', applyResize);
  }

  window.addEventListener('orientationchange', applyResize);
  if (viewport) {
    viewport.addEventListener('resize', applyResize);
    viewport.addEventListener('scroll', applyResize);
  }

  function bindDprListener() {
    if (!window.matchMedia) return;
    if (dprMql) {
      dprMql.removeEventListener('change', handleDprChange);
    }
    dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprMql.addEventListener('change', handleDprChange);
  }

  function handleDprChange() {
    bindDprListener();
    applyResize();
  }

  bindDprListener();
  applyResize();
  requestAnimationFrame(() => {
    applyResize();
    requestAnimationFrame(() => applyResize());
  });
  setTimeout(() => applyResize(), 0);
  setTimeout(() => applyResize(), 60);
  setTimeout(() => applyResize(), 180);

  return {
    resize: applyResize,
    destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', applyResize);
      }
      window.removeEventListener('orientationchange', applyResize);
      if (viewport) {
        viewport.removeEventListener('resize', applyResize);
        viewport.removeEventListener('scroll', applyResize);
      }
      if (dprMql) {
        dprMql.removeEventListener('change', handleDprChange);
      }
      if (shell) {
        shell.style.removeProperty('--gs-top-scale');
        shell.style.removeProperty('--gs-bottom-scale');
        shell.style.removeProperty('--gs-side-hud-scale');
        shell.style.removeProperty('--gs-hud-width-live');
        const topLane = shell.querySelector('.gs-snap-top');
        const bottomLane = shell.querySelector('.gs-snap-bottom');
        if (topLane) topLane.style.removeProperty('zoom');
        if (bottomLane) bottomLane.style.removeProperty('zoom');
        if (hud) hud.style.removeProperty('zoom');
        if (hud) hud.style.removeProperty('transform');
      }
      if (surface) {
        surface.style.removeProperty('width');
        surface.style.removeProperty('height');
      }
    },
  };
}
