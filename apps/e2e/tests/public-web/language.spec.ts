import { expect, test } from '@playwright/test';

test('traduce el catálogo de reservas y conserva el idioma al recargar', async ({ page }) => {
  await page.goto('/reservas');
  const catalog = page.getByTestId('public-catalog');
  await expect(
    catalog.getByRole('heading', { name: 'Establecimientos disponibles' }),
  ).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByTestId('mobile-menu-toggle').click();
  }

  const selector = page.getByTestId('language-select').filter({ visible: true });
  await expect(selector).toHaveValue('es');
  await selector.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(catalog.getByRole('heading', { name: 'Available establishments' })).toBeVisible();

  await page.reload();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByTestId('mobile-menu-toggle').click();
  }

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(selector).toHaveValue('en');
  await expect(catalog.getByRole('heading', { name: 'Available establishments' })).toBeVisible();

  await selector.selectOption('ja-JP');
  await expect(catalog.getByRole('heading', { name: '利用可能な施設' })).toBeVisible();
});
