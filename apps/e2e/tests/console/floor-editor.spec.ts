import { expect, test } from '@playwright/test';

/**
 * Flujo del editor de plantas (HU-4.01) de punta a punta:
 *   sesión de staff → abrir la vista de planta → el lienzo y la biblioteca de
 *   sectores cargan → entrar al editor del sector → volver a la planta →
 *   recargar y ver que la colocación persiste.
 *
 * Un E2E por flujo completo (regla de apps/e2e): las reglas de límites,
 * concurrencia y duplicado ya tienen tests de dominio/integración.
 *
 * Requiere el stack completo (`pnpm dev`): backend :8080, console :4200 y
 * Mailpit :8025. Los datos se siembran por la API con la sesión del tenant.
 */
const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';

const SUPER_EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const SUPER_PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';

interface SectorListItem {
  id: string;
  name: string;
}
interface FloorListItem {
  id: string;
  name: string;
}

test.describe('Consola — editor de plantas (HU-4.01)', () => {
  const run = Date.now().toString(36).slice(-6);
  const slug = `e2e-floor-${run}`;
  const email = `dueno-floor-${run}@mapit.test`;
  const password = 'S3cur3?P4ss!';

  test.beforeAll(async ({ request }) => {
    // Tenant nuevo activado por correo, como en templates.spec.ts (cada test se
    // prepara sus datos; el stack corre contra el fallback demo para spaces).
    const login = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: 'platform', email: SUPER_EMAIL, password: SUPER_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };
    const created = await request.post(`${API}/tenants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        name: `Empresa Planta E2E ${run}`,
        slug,
        vertical: 'RESTAURANT',
        administratorEmail: email,
      },
    });
    expect(created.status()).toBe(201);

    interface MxList {
      messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
    }
    await expect(async () => {
      const inbox = await request.get(`${MAILPIT}/api/v1/messages`);
      const body = (await inbox.json()) as MxList;
      expect(body.messages?.find((m) => m.To?.[0]?.Address === email)).toBeTruthy();
    }).toPass({ timeout: 10_000 });

    const list = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as MxList;
    const invitation = list.messages?.find((m) => m.To?.[0]?.Address === email);
    const detail = await request.get(`${MAILPIT}/api/v1/message/${invitation!.ID}`);
    const payload = (await detail.json()) as { Text?: string };
    const match = (payload.Text ?? '').match(
      /\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/,
    );
    expect(match).toBeTruthy();
    const [, linkSlug, rawToken] = match!;
    const activated = await request.post(`${API}/auth/activate`, {
      data: { tenantSlug: linkSlug, token: rawToken, password, passwordConfirm: password },
    });
    expect(activated.status()).toBe(200);
  });

  test('ver la planta, abrir un sector y volver: el diseño persiste al recargar', async ({
    page,
    request,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    // 1. Datos por API con el token DEL TENANT NUEVO (las rutas spaces van por
    // claim JWT; un request sin token caería en el tenant demo y la UI no lo vería).
    const loginApi = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: slug, email, password },
    });
    expect(loginApi.ok()).toBeTruthy();
    const session = (await loginApi.json()) as {
      accessToken: string;
      user: { id: string; tenantId: string };
    };
    const { accessToken } = session;
    const asTenant = { headers: { Authorization: `Bearer ${accessToken}` } };

    const est = await request.post(`${API}/establishments`, {
      ...asTenant,
      data: { name: `Sede E2E ${run}`, type: 'RESTAURANT', slug },
    });
    expect(est.status()).toBe(201);
    const estBody = (await est.json()) as { id: string };

    // Arranca con la sede sembrada seleccionada también después de recargar.
    await page.addInitScript(
      ({ origin, session, tenantSlug, establishmentId }) => {
        if (location.origin !== origin) return;
        sessionStorage.setItem('mapit.auth.session', JSON.stringify({ ...session, tenantSlug }));
        localStorage.setItem(
          `mapit.establishment.${session.user.tenantId}.${session.user.id}`,
          establishmentId,
        );
      },
      { origin: new URL(baseURL!).origin, session, tenantSlug: slug, establishmentId: estBody.id },
    );

    // 3. Seed floors and sectors.
    const floors = await request.get(`${API}/establishments/${estBody.id}/floors`, asTenant);
    const floorList = (await floors.json()) as FloorListItem[];
    let floorId = floorList[0]?.id;
    if (!floorId) {
      const f = await request.post(`${API}/establishments/${estBody.id}/floors`, {
        ...asTenant,
        data: { name: `Planta ${run}` },
      });
      expect(f.status()).toBe(201);
      floorId = ((await f.json()) as { id: string }).id;
    }

    const sectors = await request.get(`${API}/floors/${floorId}/sectors`, asTenant);
    const sectorList = (await sectors.json()) as SectorListItem[];
    let sectorId = sectorList[0]?.id;
    if (!sectorId) {
      const s = await request.post(`${API}/floors/${floorId}/sectors`, {
        ...asTenant,
        data: { name: `Salón ${run}`, slug: `salon-${run}`, maxCapacity: 40 },
      });
      expect(s.status()).toBe(201);
      sectorId = ((await s.json()) as { id: string }).id;
    }
    const element = await request.post(`${API}/sectors/${sectorId}/elements`, {
      ...asTenant,
      data: { type: 'TABLE', x: 40, y: 40, width: 80, height: 80, rotation: 0 },
    });
    expect(element.status()).toBe(201);

    // Planta B, destino de la copia del sector de la planta A.
    const fb = await request.post(`${API}/establishments/${estBody.id}/floors`, {
      ...asTenant,
      data: { name: `Planta B ${run}` },
    });
    expect(fb.status()).toBe(201);
    const floorBId = ((await fb.json()) as { id: string }).id;
    const layoutPath = `/floors/${floorBId}/layout`;
    const [, loaded] = await Promise.all([
      page.goto(`/spaces/floors/${floorBId}/editor?establishmentId=${estBody.id}`),
      page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname.endsWith(layoutPath),
      ),
    ]);
    expect(loaded.status(), 'GET del plano de la planta B').toBe(200);
    await expect(page.getByRole('heading', { name: `Planta B ${run}` })).toBeVisible();
    await expect(page.getByTestId('floor-editor-canvas')).toBeVisible();

    // Enter duplica el sector de la planta A en la planta B (RN-5).
    const source = page.locator(`[data-testid="library-sector"][data-sector-id="${sectorId}"]`);
    await expect(source).toHaveAttribute('aria-disabled', 'false');
    const [dupResp, saved] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(':duplicate')),
      page.waitForResponse(
        (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname.endsWith(layoutPath),
      ),
      source.press('Enter'),
    ]);
    expect(dupResp.status(), 'POST sectors:duplicate debe responder 201').toBe(201);
    expect(saved.status()).toBe(200);
    const sectorsAfterCopy = await request.get(`${API}/floors/${floorBId}/sectors`, asTenant);
    expect(sectorsAfterCopy.ok()).toBe(true);
    const copies = (await sectorsAfterCopy.json()) as SectorListItem[];
    expect(copies).toHaveLength(1);
    const copyId = copies[0]!.id;
    expect(copyId).not.toBe(sectorId);

    await page.goto(`/spaces/editor/${sectorId}?floorId=${floorId}`);
    await expect(page.getByRole('option', { name: /^TABLE/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goBack();
    const floorHeading = page.getByRole('heading', { name: `Planta B ${run}` });
    await expect(floorHeading).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(floorHeading).toBeVisible({ timeout: 15_000 });
    const persisted = await request.get(`${API}${layoutPath}`, asTenant);
    expect(persisted.ok()).toBe(true);
    expect(((await persisted.json()) as { sectors: unknown[] }).sectors).toContainEqual(
      expect.objectContaining({
        id: copyId,
        x: 40,
        y: 40,
        elements: expect.arrayContaining([expect.objectContaining({ type: 'TABLE' })]),
      }),
    );
  });
});
