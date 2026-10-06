import { expect, test } from '@playwright/test';

/**
 * Flujo de plantillas de elementos (HU-4.02 / MAP-207) de punta a punta:
 *   registro del tenant → activación del ADMIN → login del STAFF →
 *   ir a la página de plantillas → crear una plantilla → editarla → eliminarla.
 *
 * El test se prepara sus propios datos (no depende del seed local):
 * registra un tenant por API como SUPER_ADMIN y activa al admin vía Mailpit.
 * Requiere el stack completo (`pnpm dev`): backend :8080, console :4200 y
 * Mailpit :8025.
 */
const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';

const SUPER_EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const SUPER_PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';

test.describe('Consola — plantillas de elemento', () => {
  const run = Date.now().toString(36).slice(-6);
  const slug = `e2e-tpl-${run}`;
  const email = `dueno-${run}@mapit.test`;
  const password = 'S3cur3?P4ss!';
  const name = `Plantilla E2E ${run}`;

  test.beforeAll(async ({ request }) => {
    // 1. El SUPER_ADMIN autentica y registra el tenant (API real).
    const login = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: 'platform', email: SUPER_EMAIL, password: SUPER_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };
    const created = await request.post(`${API}/tenants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        name: `Empresa Plantillas E2E ${run}`,
        slug,
        vertical: 'RESTAURANT',
        administratorEmail: email,
      },
    });
    expect(created.status()).toBe(201);

    // 2. El correo con el enlace llega a Mailpit y se activa la cuenta.
    interface MxMessage {
      ID: string;
      To?: Array<{ Address: string }>;
    }
    interface MxList {
      messages?: MxMessage[];
    }
    await expect(async () => {
      const inbox = await request.get(`${MAILPIT}/api/v1/messages`);
      const body = (await inbox.json()) as MxList;
      const msg = body.messages?.find((m) => m.To?.[0]?.Address === email);
      expect(msg, 'no llegó el correo de invitación').toBeTruthy();
    }).toPass({ timeout: 10_000 });

    const list = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as MxList;
    const invitation = list.messages?.find((m) => m.To?.[0]?.Address === email);
    const detail = await request.get(`${MAILPIT}/api/v1/message/${invitation!.ID}`);
    const payload = (await detail.json()) as { Text?: string };
    const match = (payload.Text ?? '').match(
      /\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/,
    );
    expect(match, 'el correo no contiene el enlace de activación').toBeTruthy();
    const [, linkSlug, rawToken] = match!;

    const activated = await request.post(`${API}/auth/activate`, {
      data: { tenantSlug: linkSlug, token: rawToken, password, passwordConfirm: password },
    });
    expect(activated.status(), `activación de ${email}`).toBe(200);
  });

  test('ciclo CRUD de plantillas de elemento por el staff', async ({ page }) => {
    // Login del tenant creado por este test.
    await page.goto(`/empresa/${slug}/login`);
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
    // El botón "Nueva plantilla" confirma que estamos en la página de plantillas.
    const newButton = page.getByRole('button', { name: /nueva plantilla/i });
    await expect(newButton).toBeVisible();

    // Crear una plantilla
    await newButton.click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="type"]').selectOption('BAR');
    await page.getByRole('button', { name: 'Crear plantilla' }).click();

    // Comprobar que la plantilla aparece en la lista (la tabla muestra la
    // etiqueta traducida del tipo, no el enum crudo).
    await expect(page.getByRole('cell', { name })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Barra' })).toBeVisible();

    // Editar la plantilla
    const row = page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.locator('input[name="name"]').fill(`${name} Modificada`);
    await page.locator('select[name="type"]').selectOption('STAGE');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // Verificar los cambios
    await expect(page.getByRole('cell', { name: `${name} Modificada` })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Escenario' })).toBeVisible();

    // Eliminar la plantilla
    // Hay que interceptar el `confirm` nativo que agregamos.
    page.once('dialog', (dialog) => dialog.accept());
    const rowEdited = page.locator('tr').filter({ hasText: `${name} Modificada` });
    await rowEdited.locator('.btn-delete').click();

    // Verificar que desaparece
    await expect(page.getByRole('cell', { name: `${name} Modificada` })).not.toBeVisible();
  });
});
