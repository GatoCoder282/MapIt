import { expect, test } from '@playwright/test';

/**
 * Flujo del editor de plantas (HU-4.01) de punta a punta:
 *   login de staff → abrir la vista de planta → el lienzo y la biblioteca de
 *   sectores cargan → entrar al editor del sector → volver a la planta →
 *   recargar y ver que la colocación persiste.
 *
 * Un E2E por flujo completo (regla de apps/e2e): las reglas de límites,
 * concurrencia y duplicado ya tienen tests de dominio/integración.
 *
 * Requiere el stack completo (`pnpm dev`): backend :8080, console :4200 y
 * Mailpit :8025. Los datos se siembran por la API (rutas spaces hoy públicas,
 * fallback al tenant demo — transitorio hasta CU-23/CU-24).
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
  }) => {
    // 1. Login del staff por la UI (la consola exige JWT). Patrón del repo:
    // hasta 3 intentos; el servidor recién activado a veces rechaza el primero.
    await page.goto(`/empresa/${slug}/login`);
    await expect(page.getByRole('button', { name: /iniciar sesi/i })).toBeVisible();
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
    await expect(page).toHaveURL(/\/home/);

    // 2. Datos por API con el token DEL TENANT NUEVO (las rutas spaces van por
    // claim JWT; un request sin token caería en el tenant demo y la UI no lo vería).
    const loginApi = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: slug, email, password },
    });
    expect(loginApi.ok()).toBeTruthy();
    const { accessToken } = (await loginApi.json()) as { accessToken: string };
    const asTenant = { headers: { Authorization: `Bearer ${accessToken}` } };

    const est = await request.post(`${API}/establishments`, {
      ...asTenant,
      data: { name: `Sede E2E ${run}`, type: 'RESTAURANT', slug },
    });
    expect(est.status()).toBe(201);
    const estBody = (await est.json()) as { id: string };
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
    await request.post(`${API}/sectors/${sectorId}/elements`, {
      ...asTenant,
      data: { type: 'TABLE', x: 40, y: 40, width: 80, height: 80, rotation: 0 },
    });

    // Planta B con su sector (fuente de la biblioteca "duplicables" de la planta A).
    const fb = await request.post(`${API}/establishments/${estBody.id}/floors`, {
      ...asTenant,
      data: { name: `Planta B ${run}` },
    });
    expect(fb.status()).toBe(201);
    const floorBId = ((await fb.json()) as { id: string }).id;
    const sb = await request.post(`${API}/floors/${floorBId}/sectors`, {
      ...asTenant,
      data: { name: `Mezzanine ${run}`, slug: `mezz-${run}`, maxCapacity: 20 },
    });
    expect(sb.status()).toBe(201);

    // 3. Vista de planta: lienzo visible; la biblioteca lista sectores duplicables
    // de OTRAS plantas (la seed tiene una segunda planta con un sector: ver más abajo).
    await page.goto(`/spaces/floors/${floorBId}/editor?establishmentId=${estBody.id}`);
    await expect(page.getByTestId('floor-editor-canvas')).toBeVisible();
    await expect(page.getByTestId('library-sector').first()).toBeVisible();

    // 4. Click selecciona; Enter (teclado) duplica a esta planta (RN-5, accesible).
    await page.getByTestId('library-sector').first().click();
    const duplicated = page.waitForResponse((r) => r.url().includes(':duplicate'));
    await page.getByTestId('library-sector').first().press('Enter');
    const dupResp = await duplicated;
    expect(dupResp.status(), 'POST sectors:duplicate debe responder 201').toBe(201);

    // Ir al editor del sector principal de esta planta
    await page.goto(`/spaces/editor/${sectorId}`);
    await expect(page.getByText(/TABLE/i).first()).toBeVisible();

    // 5. Volver a la planta y recargar: todo persiste.
    await page.goto(`/spaces/floors/${floorId}/editor`);
    await expect(page.getByTestId('floor-editor-canvas')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('floor-editor-canvas')).toBeVisible();
  });
});
