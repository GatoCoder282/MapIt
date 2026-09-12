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
    // La raíz redirige al login: la consola exige JWT de staff.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /entrar|acceder|iniciar/i })).toBeVisible();
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
