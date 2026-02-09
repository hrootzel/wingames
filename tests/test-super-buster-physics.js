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

  const sample = await page.evaluate(async () => {
    const start = performance.now();
    let sawStick = false;
    let minTop = Infinity;
    while (performance.now() - start < 900) {
      const h = window.__superBusterDebug.getState().harpoon;
      if (h.active) {
        if (h.state === 'stick') sawStick = true;
        if (h.yTop < minTop) minTop = h.yTop;
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return { sawStick, minTop };
  });

  expect(sample.sawStick).toBe(true);
  expect(sample.minTop).toBeLessThanOrEqual(232.8);
  expect(sample.minTop).toBeGreaterThanOrEqual(231.2);
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

test('super buster: climbing reaches platform top and dismounts', async ({ page }) => {
  const pack = makePack({
    id: 'LAB4',
    name: 'Ladder Exit Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [{ x: 238, y: 214, w: 164, h: 12 }],
      ladders: [{ x: 300, y: 226, w: 20, h: 110 }],
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
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Ladder Exit Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayerX(310);
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');

  const player = await page.evaluate(() => window.__superBusterDebug.getState().player);
  expect(player.onLadder).toBe(false);
  expect(Math.abs(player.y - 214)).toBeLessThanOrEqual(0.5);
});

test('super buster: stepping off platform starts falling (no teleport)', async ({ page }) => {
  const pack = makePack({
    id: 'LAB5',
    name: 'Drop Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [{ x: 220, y: 214, w: 140, h: 12 }],
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
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Drop Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayer({ x: 349, y: 214, vy: 0, onLadder: false, ladderIndex: -1 });
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  const yStart = await page.evaluate(() => window.__superBusterDebug.getState().player.y);
  expect(Math.abs(yStart - 214)).toBeLessThanOrEqual(0.5);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(110);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(140);

  const yAfter = await page.evaluate(() => window.__superBusterDebug.getState().player.y);
  expect(yAfter).toBeGreaterThan(214);
  expect(yAfter).toBeLessThan(336);
});

test('super buster: can stand on ladder top and move onto side platform', async ({ page }) => {
  const pack = makePack({
    id: 'LAB6',
    name: 'Ladder Top Lab',
    timeLimitSec: 60,
    geometry: {
      solids: [
        { x: 96, y: 178, w: 182, h: 12 },
        { x: 362, y: 178, w: 182, h: 12 },
      ],
      ladders: [{ x: 313, y: 178, w: 14, h: 158 }],
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
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Ladder Top Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayer({ x: 320, y: 336, vy: 0, onLadder: false, ladderIndex: -1 });
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');

  const onTop = await page.evaluate(() => window.__superBusterDebug.getState().player);
  expect(onTop.onLadder).toBe(false);
  expect(Math.abs(onTop.y - 178)).toBeLessThanOrEqual(0.7);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(520);
  await page.keyboard.up('ArrowLeft');

  const afterMove = await page.evaluate(() => window.__superBusterDebug.getState().player);
  expect(afterMove.x).toBeLessThan(269);
  expect(Math.abs(afterMove.y - 178)).toBeLessThanOrEqual(0.9);
});

test('super buster: stopping on ladder-top gap causes fall', async ({ page }) => {
  const pack = makePack({
    id: 'LAB8',
    name: 'Ladder Gap Stop',
    timeLimitSec: 60,
    geometry: {
      solids: [
        { x: 96, y: 178, w: 182, h: 12 },
        { x: 362, y: 178, w: 182, h: 12 },
      ],
      ladders: [{ x: 313, y: 178, w: 14, h: 158 }],
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
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Ladder Gap Stop');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayer({
      x: 290,
      y: 178,
      vy: 0,
      onLadder: false,
      ladderIndex: -1,
      gapBridgeRemaining: 20,
      gapBridgeY: 178,
    });
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  await page.waitForTimeout(140);
  const after = await page.evaluate(() => window.__superBusterDebug.getState().player.y);
  expect(after).toBeGreaterThan(178);
  expect(after).toBeLessThan(336);
});

test('super buster: harpoon is anchored at player foot level when firing from platform', async ({ page }) => {
  const pack = makePack({
    id: 'LAB7',
    name: 'Harpoon Floor Anchor',
    timeLimitSec: 60,
    geometry: {
      solids: [{ x: 238, y: 214, w: 164, h: 12 }],
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
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Harpoon Floor Anchor');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayer({ x: 310, y: 214, vy: 0, onLadder: false, ladderIndex: -1 });
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
  });

  await page.keyboard.press('Space');

  await expect.poll(async () => {
    const h = await page.evaluate(() => window.__superBusterDebug.getState().harpoon);
    if (!h.active) return null;
    return h;
  }).not.toBeNull();

  const state = await page.evaluate(() => window.__superBusterDebug.getState().harpoon);
  expect(Math.abs(state.yBottom - 214)).toBeLessThanOrEqual(0.6);
  expect(state.yTop).toBeLessThan(state.yBottom);
});

test('super buster: shield pickup absorbs one hit', async ({ page }) => {
  const pack = makePack({
    id: 'LAB9',
    name: 'Shield Lab',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [{ size: 0, x: 40, y: 40, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Shield Lab');

  await page.evaluate(() => {
    const s = window.__superBusterDebug.getState();
    const p = s.player;
    window.__superBusterDebug.setBall(0, { x: 40, y: 40, vx: 0, vy: 0 });
    window.__superBusterDebug.spawnPowerup('shield', p.x, p.y - 16);
  });
  await expect.poll(async () => (await page.evaluate(() => window.__superBusterDebug.getState().player.shieldCharges))).toBe(1);

  await page.evaluate(async () => {
    window.__superBusterDebug.forcePlayerHit();
  });
  await page.waitForTimeout(60);

  const after = await page.evaluate(() => window.__superBusterDebug.getState());
  expect(after.lives).toBe(3);
  expect(after.player.shieldCharges).toBe(0);
});

test('super buster: sticky weapon keeps harpoon attached longer', async ({ page }) => {
  const pack = makePack({
    id: 'LAB10',
    name: 'Sticky Lab',
    timeLimitSec: 60,
    geometry: { solids: [{ x: 260, y: 220, w: 120, h: 12 }], ladders: [] },
    balls: [{ size: 0, x: 40, y: 40, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Sticky Lab');

  await page.evaluate(() => {
    const s = window.__superBusterDebug.getState();
    window.__superBusterDebug.spawnPowerup('sticky', s.player.x, s.player.y - 16);
  });
  await page.waitForTimeout(120);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await page.evaluate(() => window.__superBusterDebug.getState().harpoon.state))).toBe('stick');
  await page.waitForTimeout(500);
  const harpoon = await page.evaluate(() => window.__superBusterDebug.getState().harpoon);
  expect(harpoon.active).toBe(true);
});

test('super buster: double weapon allows two simultaneous harpoons', async ({ page }) => {
  const pack = makePack({
    id: 'LAB11',
    name: 'Double Lab',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [{ size: 0, x: 40, y: 40, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Double Lab');

  await page.evaluate(() => {
    const s = window.__superBusterDebug.getState();
    window.__superBusterDebug.spawnPowerup('double', s.player.x, s.player.y - 16);
  });
  await page.waitForTimeout(120);

  await page.keyboard.press('Space');
  await page.waitForTimeout(30);
  await page.keyboard.press('Space');

  await expect.poll(async () => {
    const s = await page.evaluate(() => window.__superBusterDebug.getState());
    return s.harpoons.length;
  }).toBeGreaterThan(1);
});

test('super buster: gun weapon fires bullets and can pop a ball', async ({ page }) => {
  const pack = makePack({
    id: 'LAB12',
    name: 'Gun Lab',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [{ size: 0, x: 320, y: 268, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Gun Lab');

  await page.evaluate(() => {
    const s = window.__superBusterDebug.getState();
    window.__superBusterDebug.setPlayerX(320);
    window.__superBusterDebug.setBall(0, { x: 320, y: 268, vx: 0, vy: 0 });
    window.__superBusterDebug.spawnPowerup('gun', s.player.x, s.player.y - 16);
  });
  await expect.poll(async () => (await page.evaluate(() => window.__superBusterDebug.getState().player.weaponType))).toBe('gun');

  await page.keyboard.down('Space');
  await page.waitForTimeout(260);
  await page.keyboard.up('Space');

  await expect.poll(async () => {
    const s = await page.evaluate(() => window.__superBusterDebug.getState());
    return s.balls.length;
  }).toBe(0);
});

test('super buster: hexa bubble pops with hexa score table', async ({ page }) => {
  const pack = makePack({
    id: 'LAB13',
    name: 'Hexa Score Lab',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [{ type: 'hexa', size: 2, x: 320, y: 190, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Hexa Score Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayerX(320);
    window.__superBusterDebug.setBall(0, { x: 320, y: 180, vx: 0, vy: 0 });
  });
  await page.keyboard.press('Space');

  await expect.poll(async () => {
    const s = await page.evaluate(() => window.__superBusterDebug.getState());
    if (s.balls.length >= 2) return s.score;
    return -1;
  }).toBe(1000);
});

test('super buster: level clear awards time bonus hook', async ({ page }) => {
  const pack = makePack({
    id: 'LAB14',
    name: 'Bonus Hook Lab',
    timeLimitSec: 60,
    geometry: { solids: [], ladders: [] },
    balls: [{ size: 0, x: 320, y: 190, dir: 1 }],
  });

  await page.route('**/levels/levelpack_v1.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
  });

  await page.goto('/super_buster.html');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('Bonus Hook Lab');

  await page.evaluate(() => {
    window.__superBusterDebug.setPlayerX(320);
    window.__superBusterDebug.setBall(0, { x: 320, y: 180, vx: 0, vy: 0 });
  });
  await page.keyboard.press('Space');

  await expect.poll(async () => {
    const s = await page.evaluate(() => window.__superBusterDebug.getState());
    return s.state;
  }).toBe('LEVEL_CLEAR');

  const end = await page.evaluate(() => window.__superBusterDebug.getState());
  expect(end.score).toBeGreaterThan(600);
});
