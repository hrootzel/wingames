import { test, expect } from '@playwright/test';

// Representative viewports: desktop, tablet portrait, phone portrait
const VIEWPORTS = [
  { width: 1200, height: 800, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet-portrait' },
  { width: 400, height: 700, name: 'phone-portrait' },
];

const GAMES = [
  { name: 'puzzle_puncher', noZoom: true },
  { name: 'plop_plop', noZoom: true },
  { name: 'pill_popper' },
  { name: 'blocks' },
  { name: 'prismpulse' },
  { name: 'super_buster' },
  { name: 'paddle_royale' },
];

for (const game of GAMES) {
  test(`${game.name} - canvas and HUD sizing invariants`, async ({ page }) => {
    await page.goto(`/${game.name}.html`);
    await page.waitForTimeout(2000);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(800);

      const info = await page.evaluate(() => {
        const shell = document.querySelector('.gs-shell');
        if (!shell) return null;
        const canvas = shell.querySelector('canvas');
        const hud = shell.querySelector('.gs-hud');
        const noZoomEls = shell.querySelectorAll('[data-gs-no-zoom]');
        const noZoomSizes = [...noZoomEls].map(el => {
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        });
        return {
          layout: shell.dataset.gsLayout,
          canvasW: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0,
          canvasH: canvas ? Math.round(canvas.getBoundingClientRect().height) : 0,
          hudZoom: hud ? (() => { const c = hud.querySelector(':scope > :not([data-gs-no-zoom])'); if (!c) return 1; const t = getComputedStyle(c).transform; if (!t || t === 'none') return 1; const m = t.match(/matrix\(([^,]+)/); return m ? parseFloat(m[1]) : 1; })() : 1,
          vpW: window.innerWidth,
          vpH: window.innerHeight,
          noZoomSizes,
        };
      });

      if (!info) continue;
      const label = `${game.name} @ ${vp.name} (${vp.width}x${vp.height})`;

      // Canvas should use a reasonable portion of the viewport
      // (at least 35% of the constraining dimension)
      const canvasWPct = info.canvasW / info.vpW;
      const canvasHPct = info.canvasH / info.vpH;
      const maxPct = Math.max(canvasWPct, canvasHPct);
      expect(maxPct, `${label}: canvas too small (${info.canvasW}x${info.canvasH})`)
        .toBeGreaterThanOrEqual(0.35);

      // HUD zoom should never go below 0.5
      expect(info.hudZoom, `${label}: HUD zoom ${info.hudZoom} < 0.5`)
        .toBeGreaterThanOrEqual(0.5);

      // No-zoom elements (preview panels) should stay above 40px in both dimensions
      for (let i = 0; i < info.noZoomSizes.length; i++) {
        const sz = info.noZoomSizes[i];
        expect(sz.w, `${label}: no-zoom element[${i}] width ${sz.w} < 40px`)
          .toBeGreaterThanOrEqual(40);
        expect(sz.h, `${label}: no-zoom element[${i}] height ${sz.h} < 40px`)
          .toBeGreaterThanOrEqual(40);
      }
    }
  });
}
