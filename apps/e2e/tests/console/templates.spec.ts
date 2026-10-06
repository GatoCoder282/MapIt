import { expect, test } from '@playwright/test';

/**
 * Flujo de plantillas de elementos (HU-4.02 / MAP-207) de punta a punta:
 *   login del STAFF → ir a la página de plantillas → crear una plantilla → editarla
 *   → eliminarla.
 *
 * Requiere: `pnpm dev` levantado. El seed de base de datos carga tenants demo
 * como 'restaurante'.
 */
test.describe('Consola — plantillas de elemento', () => {
  const email = 'dueno@restaurante.local';
  const password = '123';
  const name = `Plantilla E2E ${Date.now()}`;

  test('ciclo CRUD de plantillas de elemento por el staff', async ({ page }) => {
    // Login del tenant `restaurante`.
    await page.goto('/empresa/restaurante/login');
    await expect(page.getByRole('button', { name: /iniciar sesi/i })).toBeVisible();

    // Login
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByLabel(/correo electr/i).fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: /iniciar sesi/i }).click();
      const navigated = await page
        .waitForURL(/\/home/, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (navigated) break;
    }

    // Redirección por rol al home del staff.
    await expect(page).toHaveURL(/\/home/);

    // Navegar a las plantillas a través del menú
    // El side menu en mobile puede estar cerrado, lo forzamos navegando o abriéndolo.
    // Usamos la navegación directa para robustez.
    await page.goto('/spaces/templates');
    await expect(page.getByText('Plantillas de elementos', { exact: true })).toBeVisible();

    // Crear una plantilla
    await page.getByRole('button', { name: /nueva plantilla/i }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="type"]').selectOption('BAR');
    await page.getByRole('button', { name: 'Crear plantilla' }).click();

    // Comprobar que la plantilla aparece en la lista
    await expect(page.getByRole('cell', { name })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'BAR' })).toBeVisible();

    // Editar la plantilla
    const row = page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.locator('input[name="name"]').fill(`${name} Modificada`);
    await page.locator('select[name="type"]').selectOption('SEAT');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // Verificar los cambios
    await expect(page.getByRole('cell', { name: `${name} Modificada` })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'SEAT' })).toBeVisible();

    // Eliminar la plantilla
    // Hay que interceptar el `confirm` nativo que agregamos.
    page.once('dialog', (dialog) => dialog.accept());
    const rowEdited = page.locator('tr').filter({ hasText: `${name} Modificada` });
    await rowEdited.locator('.btn-delete').click();

    // Verificar que desaparece
    await expect(page.getByRole('cell', { name: `${name} Modificada` })).not.toBeVisible();
  });
});
