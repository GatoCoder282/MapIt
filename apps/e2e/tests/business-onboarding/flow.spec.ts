import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const PUBLIC_URL = process.env['PUBLIC_WEB_URL'] ?? 'http://localhost:4300';
const CONSOLE_URL = process.env['CONSOLE_URL'] ?? 'http://localhost:4200';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
const UNLEASH = process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api';
const UNLEASH_TOKEN = process.env['UNLEASH_ADMIN_TOKEN'] ?? '*:*.unleash-insecure-admin-token';
const FLAG_PATH = '/admin/projects/default/features/mapit.s6.business-applications';
const ENVIRONMENT = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';

interface MailSummary {
  ID: string;
  Subject?: string;
  To?: Array<{ Address: string }>;
}

async function messages(request: APIRequestContext, email: string): Promise<MailSummary[]> {
  const response = await request.get(`${MAILPIT}/api/v1/messages`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { messages?: MailSummary[] };
  return (body.messages ?? []).filter((item) => item.To?.some((to) => to.Address === email));
}

async function messageText(request: APIRequestContext, id: string): Promise<string> {
  const response = await request.get(`${MAILPIT}/api/v1/message/${id}`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { Text?: string };
  return body.Text ?? '';
}

test('solicitud anónima → verificación → aprobación → correos → activación', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const business = `Hotel MAP266 ${run}`;
  const email = `onboarding-${run}@mapit.test`;
  const slug = `map266-${run}`;
  const adminToken = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
  const adminPassword = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';
  const headers = { Authorization: UNLEASH_TOKEN };
  const flag = await request.get(`${UNLEASH}${FLAG_PATH}`, { headers });
  expect(flag.ok(), 'la flag debe existir en Unleash').toBeTruthy();
  const feature = (await flag.json()) as {
    environments?: Array<{ name: string; enabled: boolean }>;
  };
  const previous = feature.environments?.find((item) => item.name === ENVIRONMENT);
  expect(previous, 'debe existir el entorno de Unleash').toBeDefined();

  // La prueba corre después de los otros proyectos y restaura la flag al terminar.
  try {
    const enabled = await request.post(`${UNLEASH}${FLAG_PATH}/environments/${ENVIRONMENT}/on`, {
      headers,
    });
    expect(enabled.ok()).toBeTruthy();
    if (process.env['API_BASE_URL']) {
      await page.route('**/assets/config.json', async (route) => {
        const response = await route.fetch();
        const config = (await response.json()) as Record<string, unknown>;
        await route.fulfill({ response, json: { ...config, apiBaseUrl: API } });
      });
    }

    await expect(async () => {
      await page.goto(`${PUBLIC_URL}/incorporacion`);
      await expect(page.getByRole('button', { name: /enviar solicitud/i })).toBeVisible();
    }).toPass({ timeout: 60_000 });
    await expect(page).not.toHaveURL(/login/);
    await page.getByRole('textbox', { name: /nombre comercial/i }).fill(business);
    await page.getByRole('combobox', { name: /tipo de negocio/i }).selectOption('HOTEL');
    await page.getByRole('textbox', { name: /ubicaci/i }).fill('La Paz');
    await page.getByRole('textbox', { name: /nombre.*contacto/i }).fill('Ana E2E');
    await page.getByRole('textbox', { name: /correo.*contacto/i }).fill(email);
    // El proxy y el SDK del backend refrescan la flag en momentos distintos.
    await expect(async () => {
      await page.getByRole('button', { name: /enviar solicitud/i }).click();
      await expect(page.getByRole('status')).toContainText(/recibimos tu solicitud/i, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 60_000, intervals: [2_000, 5_000] });

    await expect.poll(async () => (await messages(request, email)).length).toBeGreaterThan(0);
    const verification = (await messages(request, email)).find((item) =>
      item.Subject?.includes('Verifica tu solicitud'),
    );
    expect(verification).toBeDefined();
    const verifyText = await messageText(request, verification!.ID);
    const token = verifyText.match(/\/incorporacion\/verificar#token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token, 'el correo debe contener el enlace de verificación').toBeTruthy();
    await page.goto(`${PUBLIC_URL}/incorporacion/verificar#token=${token}`);
    await expect(page).not.toHaveURL(/#token=/);

    const login = await request.post(`${API}/auth/global-login`, {
      data: { email: adminToken, password: adminPassword },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };
    const authorization = { Authorization: `Bearer ${accessToken}` };
    let applicationId = '';
    await expect(async () => {
      const list = await request.get(`${API}/business-applications`, {
        headers: authorization,
        params: { search: business },
      });
      expect(list.ok()).toBeTruthy();
      const body = (await list.json()) as {
        content: Array<{ id: string; contactVerifiedAt?: string }>;
      };
      expect(body.content).toHaveLength(1);
      expect(body.content[0]?.contactVerifiedAt).toBeTruthy();
      applicationId = body.content[0]!.id;
    }).toPass({ timeout: 15_000 });

    // MAP-267: apagar el alta pública no interrumpe el trabajo pendiente del Admin.
    const disabled = await request.post(`${UNLEASH}${FLAG_PATH}/environments/${ENVIRONMENT}/off`, {
      headers,
    });
    expect(disabled.ok()).toBeTruthy();
    await expect(async () => {
      await page.goto(`${PUBLIC_URL}/incorporacion`);
      await expect(page.getByRole('status')).toContainText(/no están disponibles/i);
      await expect(page.getByRole('button', { name: /enviar solicitud/i })).toHaveCount(0);
    }).toPass({ timeout: 60_000, intervals: [2_000, 5_000] });
    await testInfo.attach('solicitudes-desactivadas', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.goto(`${CONSOLE_URL}/login`);
    await page.getByTestId('login-email').fill(adminToken);
    await page.getByTestId('login-password').fill(adminPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/admin\//, { timeout: 15_000 });
    await page.goto(`${CONSOLE_URL}/admin/business-applications/${applicationId}`);
    await expect(page.getByRole('heading', { name: /ver detalle/i })).toBeVisible();
    await page.getByRole('textbox', { name: /identificador.*url/i }).fill(slug);
    await page.getByRole('button', { name: /aprobar e invitar/i }).click();
    await expect(page.getByRole('definition').filter({ hasText: 'Aprobada' })).toBeVisible();
    await testInfo.attach('solicitud-aprobada', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    const approved = await request.get(`${API}/business-applications/${applicationId}`, {
      headers: authorization,
    });
    const { approvedTenantId } = (await approved.json()) as { approvedTenantId: string };
    const tenant = await request.get(`${API}/tenants/${approvedTenantId}`, {
      headers: authorization,
    });
    expect((await tenant.json()) as { slug: string }).toMatchObject({ slug });

    await expect.poll(async () => (await messages(request, email)).length).toBe(3);
    const received = await messages(request, email);
    const result = received.find((item) => item.Subject?.includes('Resultado de tu solicitud'));
    const invitation = received.find((item) => item.Subject?.includes('Activa tu cuenta'));
    expect(result).toBeDefined();
    expect(invitation).toBeDefined();
    const resultText = await messageText(request, result!.ID);
    expect(resultText).toContain('aprobada');
    expect(resultText).not.toMatch(/token|contraseñ|password|https?:\/\//i);
    const invitationText = await messageText(request, invitation!.ID);
    const activation = invitationText.match(
      /\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/,
    );
    expect(activation).toBeTruthy();

    const repeated = await request.post(`${API}/business-applications/${applicationId}/approve`, {
      headers: authorization,
      data: { slug },
    });
    expect(repeated.ok()).toBeTruthy();
    expect((await messages(request, email)).length).toBe(3);

    await page.goto(`${PUBLIC_URL}/activar?tenant=${activation![1]}&token=${activation![2]}`);
    await page.locator('input[autocomplete="new-password"]').first().fill('S3cur3?P4ss!');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('S3cur3?P4ss!');
    await page.getByRole('button', { name: /activar cuenta/i }).click();
    await expect(page.getByRole('status')).toContainText(/activada/i);
  } finally {
    const restored = await request.post(
      `${UNLEASH}${FLAG_PATH}/environments/${ENVIRONMENT}/${previous!.enabled ? 'on' : 'off'}`,
      { headers },
    );
    expect(restored.ok(), 'la flag debe volver a su estado inicial').toBeTruthy();
  }
});
