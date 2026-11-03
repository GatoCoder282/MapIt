import { expect, test } from '@playwright/test';

test('seleccionar japonés conserva el idioma al recargar el login', async ({ page }) => {
  await page.goto('/login');

  const selector = page.getByTestId('language-select').filter({ visible: true });
  await expect(selector).toHaveValue('es');
  await selector.selectOption('ja-JP');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');
  await expect(page.getByTestId('language-select').filter({ visible: true })).toHaveValue('ja-JP');
});
