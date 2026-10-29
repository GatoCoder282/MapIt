import { test, expect } from '@playwright/test';

test('login coincide con la referencia visual (imagen)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.waitForSelector('h1', { state: 'visible' });
  await expect(page).toHaveScreenshot('login-visual.png', {
    maxDiffPixelRatio: 0.02,
    fullPage: false,
  });
});
