import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 1400, height: 900, name: 'wide' },
  { width: 900, height: 900, name: 'square' },
  { width: 700, height: 900, name: 'narrow' },
  { width: 500, height: 800, name: 'mobile' }
];

const GAMES_WITH_PREVIEWS = [
  { name: 'puzzle_puncher', canvasId: 'game-canvas', previewIds: ['next-canvas', 'next2-canvas'], logicalW: 320, logicalH: 600 },
  { name: 'blocks', canvasId: 'blocks-canvas', previewIds: ['preview-canvas'], logicalW: 300, logicalH: 720 },
  { name: 'plop_plop', canvasId: 'plop-canvas', previewIds: ['next-canvas'], logicalW: 320, logicalH: 600 },
  { name: 'pill_popper', canvasId: 'pill-canvas', previewIds: ['next-canvas'], logicalW: 320, logicalH: 540 }
];

const GAMES_WITHOUT_PREVIEWS = [
  { name: 'prismpulse', canvasId: 'pulse-canvas', logicalW: 720, logicalH: 520, bias: 'wide' },
  { name: 'super_buster', canvasId: 'buster-canvas', logicalW: 640, logicalH: 360, bias: 'wide' },
  { name: 'paddle_royale', canvasId: 'paddle-canvas', logicalW: 480, logicalH: 640 }
];

test.describe('Game Shell Layout Tests', () => {
  
  test.describe('Games with Preview Pieces', () => {
    for (const game of GAMES_WITH_PREVIEWS) {
      test(`${game.name} - layout and preview scaling`, async ({ page }) => {
        await page.goto(`http://localhost:8000/${game.name}.html`);
        await page.waitForTimeout(400);
        
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(300);
          
          const metrics = await page.evaluate((config) => {
            const shell = document.querySelector('.gs-shell');
            const gameCanvas = document.getElementById(config.canvasId);
            const hud = document.querySelector('.gs-hud');
            
            if (!shell || !gameCanvas) return null;
            
            const layout = shell.dataset.gsLayout;
            const mode = shell.dataset.gsMode;
            const gameRect = gameCanvas.getBoundingClientRect();
            const gameScale = gameRect.width / config.logicalW;
            const hudZoom = parseFloat(window.getComputedStyle(hud).zoom || '1');
            
            const previews = config.previewIds.map(id => {
              const canvas = document.getElementById(id);
              if (!canvas) return null;
              const rect = canvas.getBoundingClientRect();
              const logicalW = parseInt(canvas.getAttribute('width'));
              const scale = rect.width / logicalW;
              return {
                id,
                scale: parseFloat(scale.toFixed(3)),
                effectiveScale: parseFloat((scale / hudZoom).toFixed(3))
              };
            }).filter(p => p);
            
            return { layout, mode, gameScale: parseFloat(gameScale.toFixed(3)), hudZoom: parseFloat(hudZoom.toFixed(3)), previews };
          }, game);
          
          expect(metrics).not.toBeNull();
          expect(metrics.layout).toMatch(/^(side|stack)$/);
          expect(metrics.mode).toMatch(/^(landscape|portrait)$/);
          expect(metrics.gameScale).toBeGreaterThan(0.5);
          expect(metrics.hudZoom).toBeGreaterThanOrEqual(0.5);
          expect(metrics.hudZoom).toBeLessThanOrEqual(1.0);
          
          // Verify preview pieces exist
          expect(metrics.previews.length).toBeGreaterThan(0);
          
          // In side layout, effective preview scale should be consistent
          if (metrics.layout === 'side') {
            const effectiveScales = metrics.previews.map(p => p.effectiveScale);
            const firstScale = effectiveScales[0];
            effectiveScales.forEach(scale => {
              expect(Math.abs(scale - firstScale)).toBeLessThan(0.01);
            });
          }
        }
      });
    }
  });
  
  test.describe('Games without Preview Pieces', () => {
    for (const game of GAMES_WITHOUT_PREVIEWS) {
      test(`${game.name} - layout behavior`, async ({ page }) => {
        await page.goto(`http://localhost:8000/${game.name}.html`);
        await page.waitForTimeout(400);
        
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(300);
          
          const metrics = await page.evaluate((config) => {
            const shell = document.querySelector('.gs-shell');
            const gameCanvas = document.getElementById(config.canvasId);
            
            if (!shell || !gameCanvas) return null;
            
            const layout = shell.dataset.gsLayout;
            const mode = shell.dataset.gsMode;
            const gameRect = gameCanvas.getBoundingClientRect();
            const gameScale = gameRect.width / config.logicalW;
            
            return { layout, mode, gameScale: parseFloat(gameScale.toFixed(3)) };
          }, game);
          
          expect(metrics).not.toBeNull();
          expect(metrics.layout).toMatch(/^(side|stack)$/);
          expect(metrics.mode).toMatch(/^(landscape|portrait)$/);
          expect(metrics.gameScale).toBeGreaterThan(0.5);
          
          // Wide bias games should prefer stack layout at wide viewports
          if (game.bias === 'wide' && vp.width >= 1200) {
            expect(metrics.layout).toBe('stack');
          }
        }
      });
    }
  });
  
  test.describe('Layout Transition Behavior', () => {
    test('tall canvas transitions from side to stack', async ({ page }) => {
      await page.goto('http://localhost:8000/puzzle_puncher.html');
      await page.waitForTimeout(400);
      
      // Wide viewport - should be side
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(300);
      let layout = await page.evaluate(() => document.querySelector('.gs-shell').dataset.gsLayout);
      expect(layout).toBe('side');
      
      // Narrow viewport - should still be side
      await page.setViewportSize({ width: 700, height: 900 });
      await page.waitForTimeout(300);
      layout = await page.evaluate(() => document.querySelector('.gs-shell').dataset.gsLayout);
      expect(layout).toBe('side');
      
      // Mobile viewport - should be stack
      await page.setViewportSize({ width: 500, height: 800 });
      await page.waitForTimeout(300);
      layout = await page.evaluate(() => document.querySelector('.gs-shell').dataset.gsLayout);
      expect(layout).toBe('stack');
    });
    
    test('HUD zoom preserves canvas scale at narrow widths', async ({ page }) => {
      await page.goto('http://localhost:8000/puzzle_puncher.html');
      await page.waitForTimeout(400);
      
      // Wide viewport
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(300);
      const wideMetrics = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        const hud = document.querySelector('.gs-hud');
        const rect = canvas.getBoundingClientRect();
        return {
          scale: rect.width / 320,
          hudZoom: parseFloat(window.getComputedStyle(hud).zoom || '1')
        };
      });
      
      // Narrow viewport
      await page.setViewportSize({ width: 700, height: 900 });
      await page.waitForTimeout(300);
      const narrowMetrics = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        const hud = document.querySelector('.gs-hud');
        const rect = canvas.getBoundingClientRect();
        return {
          scale: rect.width / 320,
          hudZoom: parseFloat(window.getComputedStyle(hud).zoom || '1')
        };
      });
      
      // Canvas should be larger at narrow width
      expect(narrowMetrics.scale).toBeGreaterThan(wideMetrics.scale);
      // HUD should be zoomed
      expect(narrowMetrics.hudZoom).toBeLessThan(1.0);
    });
  });
});
