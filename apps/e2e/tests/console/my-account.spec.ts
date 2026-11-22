import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

test.skip(
  process.env['MAPIT_MY_ACCOUNT_LIVE'] !== '1',
  'Usar playwright.my-account.config.ts para aislar el ensayo real de Unleash.',
);

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const UNLEASH = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(
  /\/api\/?$/,
  '',
);
const ENVIRONMENT = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
const FLAG = '/api/admin/projects/default/features/mapit.s6.my-account';
const NEXT_PASSWORD = 'ReplacementSecret2!';
let originalEnabled = false;
let strategy: string | undefined;

interface Session {
  accessToken: string;
  user: { tenantId: string; role: string };
}
interface Profile {
  fullName: string;
  email: string;
  contactPhone: string | null;
  preferredLanguage: 'es' | 'en' | 'ja-JP' | null;
}

async function admin(request: APIRequestContext, path: string, method = 'GET', data?: unknown) {
  return request.fetch(UNLEASH + path, {
    method,
    headers: {
      Authorization: process.env['UNLEASH_ADMIN_TOKEN'] ?? '*:*.unleash-insecure-admin-token',
    },
    ...(data === undefined ? {} : { data }),
  });
}
async function flip(request: APIRequestContext, enabled: boolean) {
  expect(
    (
      await admin(request, `${FLAG}/environments/${ENVIRONMENT}/${enabled ? 'on' : 'off'}`, 'POST')
    ).ok(),
  ).toBe(true);
}
async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Session> {
  let session: Session | undefined;
  await expect(async () => {
    const response = await request.post(API + '/auth/global-login', { data: { email, password } });
    if (response.status() === 503) expect(response.headers()['retry-after']).toBe('1');
    expect(response.status()).toBe(200);
    session = (await response.json()) as Session;
  }).toPass({ timeout: 10_000, intervals: [1100] });
  return session!;
}
function headers(session: Session) {
  return { Authorization: 'Bearer ' + session.accessToken };
}
async function waitForGate(request: APIRequestContext, session: Session, enabled: boolean) {
  await expect(async () => {
    const response = await request.get(API + '/me', { headers: headers(session) });
    expect(response.status()).toBe(enabled ? 200 : 404);
    expect(response.headers()['cache-control']).toBe('no-store');
    const url = new URL(process.env['UNLEASH_PROXY_URL'] ?? 'http://localhost:3063/proxy');
    url.searchParams.set('properties[tenantId]', session.user.tenantId);
    const proxy = await request.get(url.href, {
      headers: {
        Authorization: process.env['UNLEASH_PROXY_CLIENT_KEY'] ?? 'dev-proxy-key-change-me',
      },
    });
    expect(proxy.ok()).toBe(true);
    const body = (await proxy.json()) as { toggles: { name: string; enabled: boolean }[] };
    expect(body.toggles.some((flag) => flag.name === 'mapit.s6.my-account' && flag.enabled)).toBe(
      enabled,
    );
  }).toPass({ timeout: 60_000, intervals: [1000] });
}
async function browserLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}
async function staffFixture(
  request: APIRequestContext,
  owner: Awaited<ReturnType<typeof companyAdminFixture>>,
) {
  const session = await login(request, owner.email, owner.password);
  const email = `my-account-${randomUUID()}@mapit.test`;
  expect(
    (
      await request.post(API + '/users', {
        headers: headers(session),
        data: { email, role: 'STAFF' },
      })
    ).status(),
  ).toBe(202);
  const mail = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
  let id = '';
  await expect(async () => {
    const response = await request.get(mail + '/api/v1/messages');
    const body = (await response.json()) as {
      messages?: { ID: string; To?: { Address: string }[] }[];
    };
    id = body.messages?.find((item) => item.To?.some((to) => to.Address === email))?.ID ?? '';
    expect(id).not.toBe('');
  }).toPass({ timeout: 20_000 });
  const detail = await request.get(mail + '/api/v1/message/' + id);
  const token = ((await detail.json()) as { Text: string }).Text.match(
    /\/activar\?tenant=[a-z0-9-]+&token=([A-Za-z0-9_-]+)/,
  )?.[1];
  expect(token).toBeTruthy();
  const password = 'StaffSecret1!';
  expect(
    (
      await request.post(API + '/auth/activate', {
        data: { tenantSlug: owner.slug, token, password, passwordConfirm: password },
      })
    ).ok(),
  ).toBe(true);
  return { email, password }; // Sin concesiones ni establecimiento activo.
}

test.describe('MAP-285 — Mi cuenta real', () => {
  test.beforeAll(async ({ request }) => {
    expect(['localhost', '127.0.0.1']).toContain(new URL(UNLEASH).hostname);
    let response = await admin(request, FLAG);
    if (response.status() === 404) {
      expect(
        (
          await admin(request, '/api/admin/projects/default/features', 'POST', {
            name: 'mapit.s6.my-account',
            type: 'release',
            description: 'Mi cuenta — MAP-285',
          })
        ).status(),
      ).toBe(201);
      response = await admin(request, FLAG);
    }
    expect(response.ok()).toBe(true);
    const feature = (await response.json()) as {
      environments: { name: string; enabled: boolean }[];
    };
    originalEnabled =
      feature.environments.find((env) => env.name === ENVIRONMENT)?.enabled ?? false;
    const created = await admin(request, `${FLAG}/environments/${ENVIRONMENT}/strategies`, 'POST', {
      name: 'default',
      parameters: {},
    });
    expect(created.status()).toBe(200);
    strategy = ((await created.json()) as { id: string }).id;
  });
  test.afterAll(async ({ request }) => {
    try {
      await flip(request, originalEnabled);
    } finally {
      if (strategy)
        expect(
          (
            await admin(
              request,
              `${FLAG}/environments/${ENVIRONMENT}/strategies/${strategy}`,
              'DELETE',
            )
          ).ok(),
        ).toBe(true);
    }
  });

  for (const role of ['ADMIN', 'STAFF'] as const) {
    test(`${role}: OFF/ON, edición persistida, accesibilidad, contraseña y nuevo login`, async ({
      page,
      request,
    }) => {
      test.setTimeout(180_000);
      const owner = await companyAdminFixture(request);
      const account = role === 'ADMIN' ? owner : await staffFixture(request, owner);
      const session = await login(request, account.email, account.password);
      expect(session.user.role).toBe(role);
      await flip(request, false);
      await waitForGate(request, session, false);
      await browserLogin(page, account.email, account.password);
      await page.goto('/my-account');
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByRole('link', { name: 'Mi cuenta', exact: true })).toHaveCount(0);
      await flip(request, true);
      await waitForGate(request, session, true);
      await page.goto('/my-account');
      await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible();
      const name = page.getByLabel('Nombre visible', { exact: true });
      const phone = page.getByLabel('Teléfono de contacto', { exact: true });
      const email = page.getByLabel('Correo de identidad', { exact: true });
      await expect(email).toHaveValue(account.email);
      await expect(email).toHaveAttribute('readonly', '');
      await name.focus();
      await page.keyboard.press('Tab');
      await expect(phone).toBeFocused();
      await name.fill(`QA ${role}`);
      await phone.fill('+591 555 123');
      await page.getByLabel('Idioma de la cuenta', { exact: true }).selectOption('es');
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/me') && response.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await page.reload();
      await expect(name).toHaveValue(`QA ${role}`);
      await expect(phone).toHaveValue('+591 555 123');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.getByLabel('Contraseña actual', { exact: true }).fill(account.password);
      await page.getByLabel('Nueva contraseña', { exact: true }).fill(NEXT_PASSWORD);
      await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(NEXT_PASSWORD);
      const changed = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/me/password'),
      );
      await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
      expect((await changed).status()).toBe(204);
      await expect(page).toHaveURL(/\/login$/);
      expect(
        await page.evaluate(() =>
          Boolean(
            localStorage.getItem('mapit.auth.session') ||
            sessionStorage.getItem('mapit.auth.session'),
          ),
        ),
      ).toBe(false);
      expect((await request.get(API + '/me', { headers: headers(session) })).status()).toBe(401);
      expect(
        (
          await request.post(API + '/auth/global-login', {
            data: { email: account.email, password: account.password },
          })
        ).status(),
      ).toBe(401);
      await login(request, account.email, NEXT_PASSWORD);
      await browserLogin(page, account.email, NEXT_PASSWORD);
      await page.goto('/my-account');
      await expect(name).toHaveValue(`QA ${role}`);
      const persisted = await request.get(API + '/me', {
        headers: headers(await login(request, account.email, NEXT_PASSWORD)),
      });
      expect(((await persisted.json()) as Profile).preferredLanguage).toBe('es');
    });
  }

  test('SUPER_ADMIN: mismo perfil, correo protegido y rollback sin pérdida de datos', async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const email = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
    const password = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';
    const session = await login(request, email, password);
    await flip(request, true);
    await waitForGate(request, session, true);
    const original = (await (
      await request.get(API + '/me', { headers: headers(session) })
    ).json()) as Profile;
    try {
      await browserLogin(page, email, password);
      await page.goto('/admin/profile');
      await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible();
      await expect(page.getByLabel('Correo de identidad', { exact: true })).toHaveValue(email);
      const save = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/me') && response.request().method() === 'PATCH',
      );
      await page.getByLabel('Nombre visible', { exact: true }).fill('QA SUPER_ADMIN');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      expect((await save).status()).toBe(200);
      await flip(request, false);
      await waitForGate(request, session, false);
      await expect(page.getByLabel('Nombre visible', { exact: true })).toHaveCount(0, {
        timeout: 30_000,
      });
      await page.goto('/admin/profile');
      await expect(page).toHaveURL(/\/admin\/dashboard$/);
      await flip(request, true);
      await waitForGate(request, session, true);
      await page.goto('/admin/profile');
      await expect(page.getByLabel('Nombre visible', { exact: true })).toHaveValue(
        'QA SUPER_ADMIN',
      );
    } finally {
      await flip(request, true);
      await waitForGate(request, session, true);
      expect(
        (
          await request.patch(API + '/me', {
            headers: headers(session),
            data: {
              fullName: original.fullName,
              contactPhone: original.contactPhone,
              preferredLanguage: original.preferredLanguage,
            },
          })
        ).status(),
      ).toBe(200);
    }
  });
});
