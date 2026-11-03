import { expect, test } from '@playwright/test';

test('seleccionar inglés conserva el idioma en desktop y mobile', async ({ page }) => {
  await page.goto('/');

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByTestId('mobile-menu-toggle').click();
  }

  const selector = page.getByTestId('language-select').filter({ visible: true });
  await expect(selector).toHaveValue('es');
  await selector.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByTestId('mobile-menu-toggle').click();
  }

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('language-select').filter({ visible: true })).toHaveValue('en');
});
