import { test, expect } from '@playwright/test';

test('super buster loads campaign and timer counts down', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/super_buster.html');
  await expect(page.locator('#level')).toHaveText('1');
  await expect.poll(async () => (await page.locator('#status').textContent())?.trim()).toContain('harpoon');

  const startTimeText = await page.locator('#time').textContent();
  const startTime = Number(startTimeText);
  expect(startTime).toBeGreaterThan(0);

  await page.waitForTimeout(700);

  const endTimeText = await page.locator('#time').textContent();
  const endTime = Number(endTimeText);
  expect(endTime).toBeLessThan(startTime);
  expect(pageErrors).toEqual([]);
});
