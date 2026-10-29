import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { companyAdminFixture } from '../console/company-admin-fixture';

/**
 * HU-7.01/7.02 · MAP-249: aceptación de las cuatro verticales sobre el stack real.
 *
 * Cada test crea su empresa, sus establecimientos y sus elementos por la API real (CU-25,
 * CU-04, CU-05, HU-2.03) y reserva desde el portal público, anónimo, como lo haría un cliente:
 * mapa → disponibilidad → selección → reserva → confirmación. Las reglas finas (ventanas,
 * 409, 403 con la vertical apagada) se prueban en `VerticalReservationIntegrationTest`.
 *
 * Requiere el stack completo (`pnpm dev` o `pnpm infra:full`).
 */
const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

type Vertical = 'RESTAURANT' | 'NIGHTCLUB' | 'EVENT_HALL' | 'HOTEL';

interface Venue {
  tenant: string;
  slug: string;
  elementId: string;
  token: string;
}

/** Fecha local futura y estable para la reserva (el reloj del backend es real). */
function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function adminToken(request: APIRequestContext): Promise<{ tenant: string; token: string }> {
  const admin = await companyAdminFixture(request);
  const login = await request.post(API + '/auth/login', {
    data: { tenantSlug: admin.slug, email: admin.email, password: admin.password },
  });
  expect(login.ok()).toBe(true);
  return {
    tenant: admin.slug,
    token: ((await login.json()) as { accessToken: string }).accessToken,
  };
}

/** Establecimiento de la vertical con un piso, un sector y un elemento etiquetado. */
async function seedVenue(
  request: APIRequestContext,
  owner: { tenant: string; token: string },
  type: Vertical,
  element: { type: string; label: string },
): Promise<Venue> {
  const headers = { Authorization: 'Bearer ' + owner.token };
  const slug = type.toLowerCase().replace('_', '-');
  const venue = await request.post(API + '/establishments', {
    headers,
    data: { name: 'Sede ' + slug, slug, type, timezone: 'America/La_Paz' },
  });
  expect(venue.status(), 'alta de ' + type).toBe(201);
  const venueId = ((await venue.json()) as { id: string }).id;
  const floor = await request.post(API + '/establishments/' + venueId + '/floors', {
    headers,
    data: { name: 'Planta' },
  });
  expect(floor.status()).toBe(201);
  const floorId = ((await floor.json()) as { id: string }).id;
  const sector = await request.post(API + '/floors/' + floorId + '/sectors', {
    headers,
    data: { name: 'Sala', slug: 'sala' },
  });
  expect(sector.status()).toBe(201);
  const sectorId = ((await sector.json()) as { id: string }).id;
  const created = await request.post(API + '/sectors/' + sectorId + '/elements', {
    headers,
    data: { ...element, x: 20, y: 20, width: 60, height: 60, rotation: 0 },
  });
  expect(created.status(), 'elemento ' + element.type + ' en ' + type).toBe(201);
  return {
    tenant: owner.tenant,
    slug,
    elementId: ((await created.json()) as { id: string }).id,
    token: owner.token,
  };
}

/** Busca, elige el elemento, confirma y completa la reserva desde el portal público. */
async function bookFromPortal(
  page: Page,
  venue: Venue,
  date: string,
  fill: (page: Page) => Promise<void>,
  /** Texto que debe mostrar el resumen del intervalo antes de confirmar (p. ej. el día de fin). */
  interval?: string,
): Promise<void> {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['authorization']) requests.push(request.url());
  });
  await page.goto(`/disponibilidad/${venue.tenant}/${venue.slug}?date=${date}`);
  // El perfil de vertical ya llegó cuando aparece su ayuda (turno, noche, evento o estadía).
  await expect(page.getByTestId('availability-vertical-hint')).toBeVisible();
  await fill(page);
  await page.getByTestId('availability-search').click();
  await page.getByTestId('space-' + venue.elementId).click();
  await page.getByTestId('availability-continue').click();
  await expect(page.getByTestId('booking-descriptor')).toBeVisible();
  if (interval) await expect(page.getByTestId('booking-interval')).toContainText(interval);
  await page.getByTestId('booking-confirm').click();
  await page.locator('#booking-name').fill('Ana Pérez');
  await page.locator('#booking-email').fill('ana-' + venue.slug + '@mapit.test');
  await page.getByTestId('booking-submit').click();
  await expect(page.getByTestId('booking-own-space')).toBeVisible();
  // CU-15/CU-16: el cliente final nunca envía credenciales.
  expect(requests).toEqual([]);
}

test.describe('HU-7.01/7.02 — cuatro verticales de punta a punta', () => {
  test('restaurante: mesa por turno', async ({ page, request }) => {
    const owner = await adminToken(request);
    const venue = await seedVenue(request, owner, 'RESTAURANT', { type: 'TABLE', label: 'Mesa 4' });

    await bookFromPortal(
      page,
      venue,
      futureDate(30),
      async (p) => {
        await expect(p.getByTestId('availability-vertical-hint')).toContainText('mismo día');
        await p.locator('#availability-start').fill('19:00');
        await p.locator('#availability-end').fill('21:00');
      },
      '19:00',
    );
  });

  test('discoteca: zona VIP por noche hasta la madrugada', async ({ page, request }) => {
    const owner = await adminToken(request);
    const venue = await seedVenue(request, owner, 'NIGHTCLUB', {
      type: 'SECTOR_ZONE',
      label: 'Zona VIP',
    });
    const night = futureDate(31);

    await bookFromPortal(
      page,
      venue,
      night,
      async (p) => {
        await p.locator('#availability-start').fill('23:00');
        await p.locator('#availability-end').fill('04:00');
      },
      // La salida de madrugada es del día siguiente.
      futureDate(32),
    );
  });

  test('salón de eventos: ubicación numerada por evento', async ({ page, request }) => {
    const owner = await adminToken(request);
    const venue = await seedVenue(request, owner, 'EVENT_HALL', {
      type: 'SEAT',
      label: 'Fila A · 1',
    });

    await bookFromPortal(page, venue, futureDate(33), async (p) => {
      await p.locator('#availability-start').fill('18:00');
      await p.locator('#availability-end').fill('23:00');
    });
  });

  test('hotel: habitación por estadía de dos noches', async ({ page, request }) => {
    const owner = await adminToken(request);
    const venue = await seedVenue(request, owner, 'HOTEL', {
      type: 'ROOM',
      label: 'Habitación 101',
    });
    const arrival = futureDate(34);
    const departure = futureDate(36);

    await bookFromPortal(
      page,
      venue,
      arrival,
      async (p) => {
        // Sin horas: llegada y salida, con las horas de check-in/out del perfil.
        await expect(p.locator('#availability-start')).toHaveCount(0);
        await p.locator('#availability-end-date').fill(departure);
      },
      departure,
    );
  });

  test('negativos por API: no reservable, solape y otro tenant', async ({ request }) => {
    const owner = await adminToken(request);
    const hotel = await seedVenue(request, owner, 'HOTEL', { type: 'ROOM', label: 'Suite' });
    const restaurant = await seedVenue(request, owner, 'RESTAURANT', {
      type: 'STAGE',
      label: 'Escenario',
    });
    const other = await adminToken(request);
    const foreign = await seedVenue(request, other, 'RESTAURANT', {
      type: 'TABLE',
      label: 'Mesa B',
    });
    const arrival = futureDate(40);
    const departure = futureDate(42);
    const book = (venue: Venue, element: string, data: Record<string, string>) =>
      request.post(
        `${API}/public/tenants/${venue.tenant}/establishments/${venue.slug}/reservations`,
        {
          data: {
            ...data,
            spaceElementIds: [element],
            customer: { fullName: 'Ana Pérez', email: 'ana@mapit.test' },
          },
        },
      );
    const stay = { date: arrival, startTime: '15:00', endDate: departure, endTime: '12:00' };

    expect((await book(hotel, hotel.elementId, stay)).status()).toBe(201);
    expect((await book(hotel, hotel.elementId, stay)).status()).toBe(409);
    // El escenario se dibuja pero no se reserva.
    expect(
      (
        await book(restaurant, restaurant.elementId, {
          date: arrival,
          startTime: '19:00',
          endTime: '21:00',
        })
      ).status(),
    ).toBe(400);
    // Un elemento de otro tenant nunca se reserva desde este portal.
    expect(
      (
        await book(restaurant, foreign.elementId, {
          date: arrival,
          startTime: '19:00',
          endTime: '21:00',
        })
      ).status(),
    ).toBe(404);
    // El perfil público se resuelve por slug y no cruza tenants.
    const profile = await request.get(
      `${API}/public/tenants/${foreign.tenant}/establishments/hotel/vertical-profile`,
    );
    expect(profile.status()).toBe(404);
  });
});
