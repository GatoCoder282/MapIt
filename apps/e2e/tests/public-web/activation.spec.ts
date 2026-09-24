import { expect, test } from '@playwright/test';

/**
 * CU-25 / MAP-186-187: onboarding del primer ADMIN de punta a punta:
 * el SUPER_ADMIN registra un tenant (API real), el correo llega a Mailpit,
 * el enlace se abre en public-web (/activar), el invitado define su contraseña
 * y la misma cuenta funciona en el login de la consola.
 *
 * Requiere el stack completo (`pnpm dev`): backend :8080, console :4200,
 * public-web :4300 y Mailpit :8025.
 */
const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
const CONSOLE_URL = process.env['CONSOLE_URL'] ?? 'http://localhost:4200';

const SUPER_EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const SUPER_PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';

test.describe('CU-25 — onboarding del primer ADMIN', () => {
  test('registro del tenant → correo → activación → login del ADMIN', async ({ request, page }) => {
    const run = Date.now().toString(36).slice(-6);
    const slug = `e2e-cu25-${run}`;
    const adminEmail = `admin-${run}@mapit.test`;

    // 1. El SUPER_ADMIN autentica y registra el tenant (API real).
    const login = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: 'platform', email: SUPER_EMAIL, password: SUPER_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };
    const created = await request.post(`${API}/tenants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        name: `Empresa E2E ${run}`,
        slug,
        vertical: 'RESTAURANT',
        administratorEmail: adminEmail,
      },
    });
    expect(created.status()).toBe(201);

    // 2. El correo con el enlace llega a Mailpit.
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
      const msg = body.messages?.find((m) => m.To?.[0]?.Address === adminEmail);
      expect(msg, 'no llegó el correo de invitación').toBeTruthy();
    }).toPass({ timeout: 10_000 });

    const list = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as MxList;
    const invitation = list.messages?.find((m) => m.To?.[0]?.Address === adminEmail);
    const detail = await request.get(`${MAILPIT}/api/v1/message/${invitation!.ID}`);
    const payload = (await detail.json()) as { Text?: string };
    // Mailpit responde JSON: el texto plano del correo va en `Text`.
    const text: string = payload.Text ?? '';
    const match = text.match(/\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/);
    expect(match, 'el correo no contiene el enlace de activación').toBeTruthy();
    const [, linkSlug, rawToken] = match!;

    // 3. El invitado abre el enlace y define su contraseña.
    await page.goto(`/activar?tenant=${linkSlug}&token=${rawToken}`);
    await expect(page.getByRole('heading', { name: /activa tu cuenta/i })).toBeVisible();
    await page.locator('input[autocomplete="new-password"]').first().fill('S3cur3?P4ss!');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('S3cur3?P4ss!');
    await page.getByRole('button', { name: /activar cuenta/i }).click();
    await expect(page.getByRole('status')).toContainText(/activada/i);

    // 4. El enlace no sirve dos veces.
    await page.goto(`/activar?tenant=${linkSlug}&token=${rawToken}`);
    await page.locator('input[autocomplete="new-password"]').first().fill('S3cur3?P4ss!');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('S3cur3?P4ss!');
    await page.getByRole('button', { name: /activar cuenta/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // 5. El tenant nace en aprobación: el SUPER_ADMIN lo aprueba antes del login.
    const { id } = (await created.json()) as { id: string };
    const approved = await request.patch(`${API}/tenants/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status: 'ACTIVE' },
    });
    expect(approved.ok()).toBeTruthy();

    // 6. El ADMIN entra por login de la consola con el tenant de su empresa.
    await page.goto(`${CONSOLE_URL}/empresa/${linkSlug}/login`);
    await page.getByLabel(/correo electr/i).fill(adminEmail);
    await page.locator('#password').fill('S3cur3?P4ss!');
    await page.getByRole('button', { name: /iniciar sesi/i }).click();
    await expect(page).toHaveURL(/\/home|\/admin/, { timeout: 15_000 });
  });

  test('un enlace sin parámetros avisa claramente', async ({ page }) => {
    await page.goto('/activar');
    await expect(page.getByRole('alert')).toContainText(/enlace/i);
  });
});
