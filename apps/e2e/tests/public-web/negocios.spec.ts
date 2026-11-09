import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('la página Negocios funciona de forma anónima y responsive', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });

  const response = await page.goto('/negocios');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator('mp-negocios')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar distribución de mesas' })).toHaveAttribute(
    'href',
    /\/spaces\/setup$/,
  );

  const header = page.getByRole('banner');
  const businessesLink = header.locator('nav').first().locator('a[href="/negocios"]');
  await expect(businessesLink).toBeVisible();
  await businessesLink.click();
  await expect(page).toHaveURL(/\/negocios$/);

  for (const id of [
    'industries-title',
    'operation-title',
    'venues-title',
    'booking-title',
    'steps-title',
  ]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator('#como-funciona')).toBeAttached();
  await expect(page.locator('#contacto')).toBeAttached();
  await expect(page.getByRole('contentinfo')).toBeVisible();

  const dialog = page.getByRole('dialog');
  const finalCta = page.getByRole('button', { name: 'Unite a MapIt' });
  await finalCta.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(finalCta).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const menuToggle = page.getByTestId('mobile-menu-toggle');
  await expect(menuToggle).toBeVisible();
  await menuToggle.focus();
  await page.keyboard.press('Enter');
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu').getByRole('navigation')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menuToggle).toBeFocused();

  const images = page.locator('main img:visible');
  for (let index = 0; index < (await images.count()); index++) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
  }

  const screenshotDir = resolve(
    testInfo.config.rootDir,
    '..',
    '..',
    '..',
    'test-results',
    'negocios-reference',
    testInfo.project.name,
  );
  await mkdir(screenshotDir, { recursive: true });
  for (const width of [360, 390, 768, 992, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({
      path: resolve(screenshotDir, `negocios-${width}.png`),
      fullPage: true,
    });
  }

  expect(pageErrors, 'uncaught browser errors').toEqual([]);
  expect(consoleErrors, 'browser console errors').toEqual([]);
  if (consoleWarnings.length > 0) {
    await testInfo.attach('browser-console-warnings', {
      body: consoleWarnings.join('\n'),
      contentType: 'text/plain',
    });
  }
});
