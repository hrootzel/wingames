import { test, expect } from '@playwright/test';

function makePack(level) {
  return {
    version: 1,
    defaults: { timeLimitSec: 60 },
    levels: [level],
  };
}

test('super buster: ball resolves against platform top without tunneling', async ({ page }) => {
  const pack = makePack({
    id: 'LAB1',
    name: 'Collision Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [{ x: 220, y: 220, w: 200, h: 12 }],
      ladders: [],
    },
    balls: [{ size: 1, x: 320, y: 170, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pack),
    });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Collision Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setBall(0, {
      x: 320,
      y: 190,
      prevX: 320,
      prevY: 180,
      vx: 0,
      vy: 280,
    });
  });

  const sample = await page.evaluate(async () => {
    const top = 220;
    const radius = 16;
    const start = performance.now();
    let maxPenetration = -Infinity;
    let sawBounce = false;
    while (performance.now() - start < 800) {
      const s = window.__superBusterDebug.getState();
      const b = s.balls[0];
      if (b) {
        const penetration = b.y + radius - top;
        if (penetration > maxPenetration) maxPenetration = penetration;
        if (b.vy < 0) sawBounce = true;
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return { maxPenetration, sawBounce };
  });

  expect(sample.sawBounce).toBe(true);
  expect(sample.maxPenetration).toBeLessThanOrEqual(0.6);
});

test('super buster: harpoon sticks to platform underside', async ({ page }) => {
  const pack = makePack({
    id: 'LAB2',
    name: 'Harpoon Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [{ x: 240, y: 220, w: 160, h: 12 }],
      ladders: [],
    },
    balls: [{ size: 0, x: 40, y: 40, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pack),
    });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Harpoon Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayerX(320);
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });
  await page.keyboard.press('Space');

  await expect.poll(async () => {
    const h = await page.evaluate(() => window.__superBusterDebug.getState().harpoon);
    return h.state;
  }).toBe('stick');

  await expect.poll(async () => {
    const h = await page.evaluate(() => window.__superBusterDebug.getState().harpoon);
    return h.yTop;
  }).toBeCloseTo(232, 0);
});

test('super buster: ArrowUp is captured for ladder climb', async ({ page }) => {
  const pack = makePack({
    id: 'LAB3',
    name: 'Ladder Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [],
      ladders: [{ x: 300, y: 180, w: 20, h: 156 }],
    },
    balls: [{ size: 0, x: 40, y: 40, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pack),
    });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Ladder Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayerX(310);
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  const before = await page.evaluate(() => window.__superBusterDebug.getState().player.y);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => window.__superBusterDebug.getState().player);

  expect(after.onLadder).toBe(true);
  expect(after.y).toBeLessThan(before - 2);
});
