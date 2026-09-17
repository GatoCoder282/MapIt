import { expect, test } from '@playwright/test';

/**
 * Humo de la vista pública.
 */
test.describe('Vista pública — humo', () => {
  test('carga la portada', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MapIt/);
    // El texto de la portada es copy de marketing y cambia con cada rediseño;
    // lo estructural que debe mantenerse es que exista un <h1> visible.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('no exige autenticación', async ({ page }) => {
    // El cliente final es anónimo hasta confirmar una reserva (CU-15, CU-16).
    // Si esto redirige a un login, la superficie pública se rompió.
    const respuesta = await page.goto('/');
    expect(respuesta?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/login/);
  });
});
