import { expect, test } from '@playwright/test';

/**
 * Humo de la consola.
 *
 * Comprueba que la app carga y que el andamiaje está en pie. Los flujos reales
 * (editor, operación, reservas) llegan con sus casos de uso.
 */
test.describe('Consola — humo', () => {
  test('carga y muestra el título', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MapIt/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('MapIt');
  });

  test('no hay errores de consola al arrancar', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errores.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errores, `Errores en consola:\n${errores.join('\n')}`).toHaveLength(0);
  });

  test('una ruta inexistente muestra el 404, no una pantalla en blanco', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe');
    await expect(page.getByText('404')).toBeVisible();
  });
});
