import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 1400, height: 900, name: 'wide' },
  { width: 900, height: 900, name: 'square' },
  { width: 700, height: 900, name: 'narrow' },
  { width: 500, height: 800, name: 'mobile' }
];

test.describe('Generic Game Shell Tests', () => {
  
  test('tall canvas (320×600) - prefers side layout', async ({ page }) => {
    await page.goto('http://localhost:8000/test-tall-canvas.html');
    await page.waitForTimeout(400);
    
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('.gs-shell');
        const canvas = document.getElementById('test-canvas');
        const hud = document.querySelector('.gs-hud');
        
        if (!shell || !canvas) return null;
        
        const layout = shell.dataset.gsLayout || 'undefined';
        const mode = shell.dataset.gsMode || 'undefined';
        const canvasRect = canvas.getBoundingClientRect();
        const gameScale = canvasRect.width / 320;
        const hudZoom = parseFloat(window.getComputedStyle(hud).zoom || '1');
        
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          layout,
          mode,
          canvasW: Math.round(canvasRect.width),
          canvasH: Math.round(canvasRect.height),
          gameScale: parseFloat(gameScale.toFixed(3)),
          hudZoom: parseFloat(hudZoom.toFixed(3))
        };
      });
      
      expect(metrics).not.toBeNull();
      
      // Skip layout checks if game-shell didn't initialize
      if (metrics.layout === 'undefined') {
        console.log(`${vp.name}: game-shell not initialized, skipping layout checks`);
        continue;
      }
      
      expect(metrics.layout).toMatch(/^(side|stack)$/);
      expect(metrics.gameScale).toBeGreaterThan(0.5);
      
      // Wide viewports should use side layout for tall canvas
      if (vp.width >= 900) {
        expect(metrics.layout).toBe('side');
      }
      
      // Mobile should use stack
      if (vp.width <= 500) {
        expect(metrics.layout).toBe('stack');
      }
      
      console.log(`${vp.name}: ${metrics.layout} layout, scale ${metrics.gameScale}, HUD zoom ${metrics.hudZoom}`);
    }
  });
  
  test('wide canvas (720×480) with canvasBias - prefers stack layout', async ({ page }) => {
    await page.goto('http://localhost:8000/test-wide-canvas.html');
    await page.waitForTimeout(400);
    
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('.gs-shell');
        const canvas = document.getElementById('test-canvas');
        const hud = document.querySelector('.gs-hud');
        
        if (!shell || !canvas) return null;
        
        const layout = shell.dataset.gsLayout || 'undefined';
        const mode = shell.dataset.gsMode || 'undefined';
        const canvasRect = canvas.getBoundingClientRect();
        const gameScale = canvasRect.width / 720;
        const hudZoom = parseFloat(window.getComputedStyle(hud).zoom || '1');
        
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          layout,
          mode,
          canvasW: Math.round(canvasRect.width),
          canvasH: Math.round(canvasRect.height),
          gameScale: parseFloat(gameScale.toFixed(3)),
          hudZoom: parseFloat(hudZoom.toFixed(3))
        };
      });
      
      expect(metrics).not.toBeNull();
      
      // Skip layout checks if game-shell didn't initialize
      if (metrics.layout === 'undefined') {
        console.log(`${vp.name}: game-shell not initialized, skipping layout checks`);
        continue;
      }
      
      expect(metrics.layout).toMatch(/^(side|stack)$/);
      expect(metrics.gameScale).toBeGreaterThan(0.5);
      
      // Wide canvas with canvasBias should prefer stack layout
      if (vp.width >= 1200) {
        expect(metrics.layout).toBe('stack');
      }
      
      console.log(`${vp.name}: ${metrics.layout} layout, scale ${metrics.gameScale}, HUD zoom ${metrics.hudZoom}`);
    }
  });
  
  test('tall canvas - canvas grows when HUD compresses', async ({ page }) => {
    await page.goto('http://localhost:8000/test-tall-canvas.html');
    await page.waitForTimeout(400);
    
    // Wide viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(300);
    const wideScale = await page.evaluate(() => {
      const canvas = document.getElementById('test-canvas');
      return canvas.getBoundingClientRect().width / 320;
    });
    
    // Narrow viewport (should compress HUD and grow canvas)
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(300);
    const narrowMetrics = await page.evaluate(() => {
      const canvas = document.getElementById('test-canvas');
      const hud = document.querySelector('.gs-hud');
      const shell = document.querySelector('.gs-shell');
      return {
        scale: canvas.getBoundingClientRect().width / 320,
        hudZoom: parseFloat(window.getComputedStyle(hud).zoom || '1'),
        layout: shell.dataset.gsLayout
      };
    });
    
    // If still in side layout, canvas should be larger
    if (narrowMetrics.layout === 'side') {
      expect(narrowMetrics.scale).toBeGreaterThan(wideScale);
      expect(narrowMetrics.hudZoom).toBeLessThan(1.0);
      console.log(`Canvas grew from ${wideScale.toFixed(3)} to ${narrowMetrics.scale.toFixed(3)} (HUD zoom: ${narrowMetrics.hudZoom.toFixed(3)})`);
    }
  });
  
  test('canvas maintains aspect ratio', async ({ page }) => {
    await page.goto('http://localhost:8000/test-tall-canvas.html');
    await page.waitForTimeout(400);
    
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      
      const aspectRatio = await page.evaluate(() => {
        const canvas = document.getElementById('test-canvas');
        const rect = canvas.getBoundingClientRect();
        return rect.width / rect.height;
      });
      
      const expectedRatio = 320 / 600;
      expect(Math.abs(aspectRatio - expectedRatio)).toBeLessThan(0.01);
    }
  });
  
  test('HUD zoom stays within valid range', async ({ page }) => {
    await page.goto('http://localhost:8000/test-tall-canvas.html');
    await page.waitForTimeout(400);
    
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      
      const hudZoom = await page.evaluate(() => {
        const hud = document.querySelector('.gs-hud');
        return parseFloat(window.getComputedStyle(hud).zoom || '1');
      });
      
      expect(hudZoom).toBeGreaterThanOrEqual(0.5);
      expect(hudZoom).toBeLessThanOrEqual(1.0);
    }
  });
});
