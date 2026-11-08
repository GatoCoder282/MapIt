import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/** Humo de la portada pública y su comportamiento responsive. */
test('la portada pública funciona de forma anónima en varios viewports', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/MapIt/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
  await expect(page.getByRole('banner').getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText(String(new Date().getFullYear()));
  await expect(page).toHaveURL(/acerca-de-mapit/);
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Producto', exact: true }),
  ).toHaveCount(0);

  const screenshotDir = resolve(
    testInfo.config.rootDir,
    '..',
    '..',
    '..',
    'test-results',
    'landing-reference',
    testInfo.project.name,
  );
  await mkdir(screenshotDir, { recursive: true });

  const images = page.locator('img');
  for (let index = 0; index < (await images.count()); index++) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
  }

  const menuToggle = page.getByTestId('mobile-menu-toggle');
  await page.setViewportSize({ width: 390, height: 844 });
  await menuToggle.focus();
  await page.keyboard.press('Enter');
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu').getByRole('navigation')).toBeVisible();
  await menuToggle.press('Enter');
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menuToggle).toBeFocused();

  for (const width of [360, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({
      path: resolve(screenshotDir, `landing-${width}.png`),
      fullPage: true,
    });
  }

  await page.getByRole('banner').getByRole('link', { name: 'Cómo funciona', exact: true }).click();
  await expect(page).toHaveURL(/\/como-funciona$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'Negocios', exact: true }).click();
  await expect(page).toHaveURL(/\/negocios$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  expect(pageErrors, 'uncaught browser errors').toEqual([]);
  expect(consoleErrors, 'browser console errors').toEqual([]);
});
