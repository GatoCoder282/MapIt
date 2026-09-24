import { expect, test } from '@playwright/test';

/**
 * Flujo de administración de tenants (CU-01/CU-03) de punta a punta:
 *   login del SUPER_ADMIN → shell → listado → crear → detalle → editar → aprobar → suspender/reactivar.
 *
 * Requiere: `pnpm dev` levantado y el SUPER_ADMIN sembrado por el backend
 * (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD). El slug es único por corrida.
 */
test.describe('Consola — administración de tenants', () => {
  const email = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
  const password = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';
  const slug = `e2e-tenant-${Date.now().toString(36)}`.slice(0, 20);

  test('acceso directo sin sesión redirige al login', async ({ page }) => {
    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/login/);
  });

  test('ciclo completo del SUPER_ADMIN', async ({ page }) => {
    // Login del tenant técnico `platform`.
    await page.goto('/empresa/platform/login');
    await expect(page.getByRole('button', { name: /iniciar sesi/i })).toBeVisible();

    // El dev server puede re-montar el formulario en frío; si el submit cae en una
    // validación prematura, reintentar con los campos de nuevo informados.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByLabel(/correo electr/i).fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: /iniciar sesi/i }).click();
      const navigated = await page
        .waitForURL(/\/admin\//, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (navigated) break;
    }

    // Redirección por rol al módulo de tenants dentro del shell.
    await expect(page).toHaveURL(/\/admin\/tenants/);
    await expect(page.getByRole('link', { name: 'Tenants' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Plataforma' })).toBeVisible();

    // Crear un tenant desde el listado.
    await page.getByRole('link', { name: /nuevo tenant/i }).click();
    await expect(page).toHaveURL(/\/admin\/tenants\/new/);
    await page.getByLabel(/nombre de la organizaci/i).fill(`Empresa E2E ${slug}`);
    await page.getByLabel(/slug/i).fill(slug);
    await page.getByLabel(/correo del administrador/i).fill('admin@e2e.test');
    await page.getByRole('button', { name: /registrar tenant/i }).click();

    // Vuelta al listado tras éxito y aparición del registro.
    await page.getByRole('link', { name: /volver al listado/i }).click();
    await expect(page).toHaveURL(/\/admin\/tenants$/);
    await expect(page.getByRole('cell', { name: slug, exact: true })).toBeVisible();

    // Slug duplicado: el backend responde 409 y la UI lo muestra.
    await page.getByRole('link', { name: /nuevo tenant/i }).click();
    await page.getByLabel(/nombre de la organizaci/i).fill('Duplicada');
    await page.getByLabel(/slug/i).fill(slug);
    await page.getByLabel(/correo del administrador/i).fill('otro@e2e.test');
    await page.getByRole('button', { name: /registrar tenant/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Detalle: editar nombre.
    await page.goto('/admin/tenants');
    await page
      .getByRole('row', { name: new RegExp(slug) })
      .getByRole('link', { name: /ver detalle/i })
      .click();
    await expect(page).toHaveURL(/\/admin\/tenants\/.+/);
    await page.getByRole('button', { name: /^editar$/i }).click();
    await page.getByLabel(/nombre de la organizaci/i).fill(`Empresa E2E ${slug} Editada`);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText(`Empresa E2E ${slug} Editada`)).toBeVisible();

    // Nace en aprobación: aprobar con confirmación.
    await expect(page.getByText('En aprobación')).toBeVisible();
    await page.getByRole('button', { name: /^aprobar$/i }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /confirmar/i })
      .click();
    await expect(page.getByText('Activo')).toBeVisible();

    // Suspender con confirmación.
    await page.getByRole('button', { name: /suspender/i }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /confirmar/i })
      .click();
    await expect(page.getByText('Suspendido')).toBeVisible();

    // Reactivar.
    await page.getByRole('button', { name: /reactivar/i }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /confirmar/i })
      .click();
    await expect(page.getByText('Activo')).toBeVisible();
  });
});
