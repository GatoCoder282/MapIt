import { expect, test } from '@playwright/test';

const AS_OF = '2026-10-25T12:00:00Z';
const TOKEN = 'opaque-session-for-e2e';
const NEXT_TOKEN = 'second-opaque-session-for-e2e';
const OTHER_TENANT_TOKEN = 'tenant-b-opaque-session';
const BASE = '**/api/v1/public/tenants/demo';

function reservation(id: string, status: string, startsAt: string, endsAt: string) {
  return {
    id,
    establishmentId: '20000000-0000-0000-0000-000000000001',
    establishmentName: 'La Bahía',
    spaceElementIds: ['30000000-0000-0000-0000-000000000001'],
    startsAt,
    endsAt,
    timezone: 'America/La_Paz',
    status,
    createdAt: AS_OF,
  };
}

test('consulta el historial desde el enlace y lo borra al salir', async ({ page }) => {
  const requests: { period: string; asOf: string | null; offset: string | null }[] = [];
  let revoked = false;
  let exchanges = 0;
  let currentToken = TOKEN;

  await page.route(`${BASE}/history-access-requests`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'ana@example.com' });
    expect(route.request().headers()['x-customer-history-session']).toBeUndefined();
    await route.fulfill({ status: 202 });
  });
  await page.route(`${BASE}/history-sessions`, async (route) => {
    expect(page.url()).not.toContain('token=');
    const link = (route.request().postDataJSON() as { token: string }).token;
    expect(['link-from-email', 'second-link']).toContain(link);
    currentToken = link === 'second-link' ? NEXT_TOKEN : TOKEN;
    exchanges++;
    expect(route.request().headers()['x-customer-history-session']).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionToken: currentToken,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    });
  });
  await page.route(`${BASE}/my-reservations?*`, async (route) => {
    const request = route.request();
    expect(request.headers()['x-customer-history-session']).toBe(currentToken);
    expect(request.headers()['authorization']).toBeUndefined();
    const url = new URL(request.url());
    const period = url.searchParams.get('period') ?? '';
    const offset = url.searchParams.get('offset');
    requests.push({ period, asOf: url.searchParams.get('asOf'), offset });
    const items =
      period === 'past'
        ? [reservation('past-1', 'RELEASED', '2026-10-23T20:00:00Z', '2026-10-23T22:00:00Z')]
        : offset === '1'
          ? [reservation('future-2', 'CONFIRMED', '2026-10-27T19:00:00Z', '2026-10-27T21:00:00Z')]
          : [reservation('future-1', 'CANCELLED', '2026-10-26T03:30:00Z', '2026-10-26T04:30:00Z')];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        asOf: AS_OF,
        hasMore: period === 'upcoming' && offset !== '1',
      }),
    });
  });
  await page.route(`${BASE}/history-sessions/revoke`, async (route) => {
    expect(route.request().headers()['x-customer-history-session']).toBe(currentToken);
    expect(route.request().headers()['authorization']).toBeUndefined();
    revoked = true;
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/public/tenants/tenant-b/history-sessions', async (route) => {
    expect(page.url()).not.toContain('token=');
    expect(route.request().postDataJSON()).toEqual({ token: 'third-link' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionToken: OTHER_TENANT_TOKEN,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    });
  });
  await page.route('**/api/v1/public/tenants/tenant-b/my-reservations?*', async (route) => {
    expect(route.request().headers()['x-customer-history-session']).toBe(OTHER_TENANT_TOKEN);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], hasMore: false, asOf: AS_OF }),
    });
  });

  await page.goto('/mis-reservas/demo');
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('Si el correo está registrado');

  await page.goto('/mis-reservas/demo#token=link-from-email');
  await expect(page).toHaveURL(/\/mis-reservas\/demo$/);
  const upcoming = page.getByRole('region', { name: 'Próximas' });
  const past = page.getByRole('region', { name: 'Pasadas' });
  await expect(upcoming.getByText('Cancelada')).toBeVisible();
  await expect(upcoming).toContainText('25 de octubre');
  await expect(upcoming).toContainText('26 de octubre');
  await expect(past.getByText('Finalizada')).toBeVisible();
  await upcoming.getByRole('button', { name: 'Cargar más' }).click();
  await expect(upcoming.getByText('Confirmada')).toBeVisible();
  expect(requests).toEqual([
    { period: 'upcoming', asOf: null, offset: '0' },
    { period: 'past', asOf: AS_OF, offset: '0' },
    { period: 'upcoming', asOf: AS_OF, offset: '1' },
  ]);

  await page.getByRole('button', { name: 'Salir de mis reservas' }).click();
  await expect(page.getByRole('textbox', { name: 'Correo electrónico' })).toBeVisible();
  await expect(page.getByText('La Bahía')).toHaveCount(0);
  expect(revoked).toBe(true);
  await expect(page).not.toHaveURL(/token=/);

  // Un segundo enlace abierto en la misma ruta debe canjearse una sola vez.
  await page.goto('/mis-reservas/demo#token=second-link');
  await expect(page).toHaveURL(/\/mis-reservas\/demo$/);
  await expect(upcoming.getByText('Cancelada')).toBeVisible();
  expect(exchanges).toBe(2);
  await expect(page).not.toHaveURL(/token=/);

  // Una navegación completa al tenant B no recupera del navegador la sesión de A.
  await page.goto('/mis-reservas/tenant-b#token=third-link');
  await expect(page).toHaveURL(/\/mis-reservas\/tenant-b$/);
  await expect(page.getByText('Todavía no hay reservas próximas.')).toBeVisible();
  await expect(page.getByText('La Bahía')).toHaveCount(0);
});
