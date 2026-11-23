import { expect, test } from '@playwright/test';

test('el dashboard reacciona a ON/OFF y recupera el polling sin recargar', async ({ page }) => {
  const userId = '94000000-0000-0000-0000-000000000001';
  const establishmentId = '94000000-0000-0000-0000-000000000002';
  const establishment = {
    id: establishmentId,
    name: 'Audit fixture',
    slug: 'audit-fixture',
    type: 'RESTAURANT',
    timezone: 'America/La_Paz',
    address: null,
    canManagePayments: false,
    canCheckIn: true,
  };
  let enabled = true;
  let offline = false;
  const contexts: URLSearchParams[] = [];
  await page.clock.install();
  await page.addInitScript(
    ({ userId, establishmentId }) => {
      sessionStorage.setItem(
        'mapit.auth.session',
        JSON.stringify({
          accessToken: 'audit.fixture.token',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          user: {
            id: userId,
            tenantId: 'audit-tenant',
            email: 'audit@example.test',
            fullName: 'Audit fixture',
            role: 'ADMIN',
          },
        }),
      );
      localStorage.setItem('mapit.establishment.audit-tenant.' + userId, establishmentId);
    },
    { userId, establishmentId },
  );
  await page.route('**/assets/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: '/__flags-audit-api',
        wsUrl: '',
        unleashProxyUrl: '/__flags-audit-proxy',
        unleashClientKey: 'audit-client-key',
        environment: 'test',
      },
    }),
  );
  await page.route('**/__flags-audit-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path.endsWith('/establishments') || path.endsWith('/establishments/accessible')
        ? [establishment]
        : path.endsWith('/element-states/summary')
          ? {
              total: 0,
              byState: { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0, OUT_OF_SERVICE: 0 },
            }
          : [];
    return route.fulfill({ json });
  });
  await page.route('**/__flags-audit-proxy**', (route) => {
    const request = route.request();
    expect(request.headers()['authorization']).toBe('audit-client-key');
    expect(request.headers()['cookie']).toBeUndefined();
    contexts.push(new URL(request.url()).searchParams);
    return offline
      ? route.abort('failed')
      : route.fulfill({
          json: {
            toggles: enabled ? [{ name: 'payments.qr', enabled: true }] : [],
          },
        });
  });

  await page.goto('/home');
  const active = page.getByText(/La capacidad «payments.qr» ya está activa/);
  const inactive = page.getByText(/rama con datos reales depende de la flag «payments.qr»/);
  await expect(active).toBeVisible();
  await expect
    .poll(() =>
      contexts.some(
        (context) =>
          context.get('properties[tenantId]') === 'audit-tenant' &&
          context.get('properties[establishmentId]') === establishmentId &&
          context.get('userId') === userId,
      ),
    )
    .toBe(true);

  enabled = false;
  await page.clock.fastForward(16_000);
  await expect(inactive).toBeVisible();
  await expect(active).toHaveCount(0);
  offline = true;
  enabled = true;
  const calls = contexts.length;
  await page.clock.fastForward(16_000);
  await expect.poll(() => contexts.length).toBeGreaterThan(calls);
  await expect(inactive).toBeVisible();
  offline = false;
  await page.clock.fastForward(16_000);
  await expect(active).toBeVisible();
  await expect(inactive).toHaveCount(0);
  await expect(page).toHaveURL(/\/home$/);
});
