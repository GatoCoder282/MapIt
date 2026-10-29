import { expect, test } from '@playwright/test';

const RESERVATION_ID = '40000000-0000-0000-0000-000000000001';
const ELEMENT_ID = '20000000-0000-0000-0000-000000000001';
const ESTABLISHMENT_ID = '10000000-0000-0000-0000-000000000001';
const DATE = '2030-12-24';
const ACCESS_TOKEN = 'A'.repeat(43);
const API_SCOPE = '/api/v1/public/tenants/demo/establishments/la-bahia';
const BOOKING_URL = `/reservar/demo/la-bahia/${ELEMENT_ID}?date=${DATE}&startTime=19:00&endTime=21:00`;
const venue = {
  id: ESTABLISHMENT_ID,
  name: 'La Bahía',
  tenantName: 'Empresa de prueba',
  type: 'RESTAURANT',
  address: 'Av. Principal 123',
  tenantSlug: 'demo',
  establishmentSlug: 'la-bahia',
  timezone: 'America/La_Paz',
};
const interval = {
  startsAt: `${DATE}T23:00:00Z`,
  endsAt: '2030-12-25T01:00:00Z',
};

// Regresión de UI con respuestas controladas. El flujo persistido se prueba en payment-live.
const map = {
  establishmentId: ESTABLISHMENT_ID,
  establishmentName: venue.name,
  tenantSlug: venue.tenantSlug,
  establishmentSlug: venue.establishmentSlug,
  timezone: venue.timezone,
  date: DATE,
  startTime: '19:00',
  endTime: '21:00',
  ...interval,
  mode: 'INTERVAL',
  floors: [
    {
      id: '30000000-0000-0000-0000-000000000001',
      name: 'Planta baja',
      level: 0,
      canvasWidth: 1200,
      canvasHeight: 800,
      sectors: [
        {
          id: '30000000-0000-0000-0000-000000000002',
          name: 'Terraza',
          x: 0,
          y: 0,
          width: 1000,
          height: 600,
          rotation: 0,
          elements: [
            {
              id: ELEMENT_ID,
              type: 'TABLE',
              name: 'Mesa Terraza',
              label: 'Mesa Terraza',
              capacity: 4,
              x: 100,
              y: 100,
              width: 100,
              height: 80,
              rotation: 0,
              availability: 'AVAILABLE',
              selectable: true,
            },
          ],
        },
      ],
    },
  ],
};

test.describe('Reserva pública', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2030-12-20T12:00:00Z'));
    await page.route(`**${API_SCOPE}`, (route) => route.fulfill({ json: venue }));
    await page.route(`**${API_SCOPE}/availability/map?*`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get('date')).toBe(DATE);
      expect(params.get('startTime')).toBe('19:00');
      expect(params.get('endTime')).toBe('21:00');
      expect(route.request().headers()['authorization']).toBeUndefined();
      return route.fulfill({ json: map });
    });
  });

  test('registra una reserva anónima y muestra el código y espacio elegido', async ({ page }) => {
    let payload: unknown;
    await page.route(`**${API_SCOPE}/reservations/${RESERVATION_ID}/checkout`, (route) => {
      expect(route.request().headers()['x-reservation-access']).toBe(ACCESS_TOKEN);
      expect(route.request().headers()['authorization']).toBeUndefined();
      return route.fulfill({
        json: {
          reservation: {
            id: RESERVATION_ID,
            establishmentId: ESTABLISHMENT_ID,
            establishmentName: venue.name,
            tenantSlug: venue.tenantSlug,
            establishmentSlug: venue.establishmentSlug,
            timezone: venue.timezone,
            ...interval,
            status: 'CREATED',
            spaces: [
              {
                id: ELEMENT_ID,
                name: 'Mesa Terraza',
                type: 'TABLE',
                label: 'Mesa Terraza',
                capacity: 4,
                floor: 'Planta baja',
                sector: 'Terraza',
                state: 'AVAILABLE',
                x: 100,
                y: 100,
              },
            ],
          },
          available: false,
          unavailableReason: 'POLICY_MISSING',
          currency: null,
          amount: null,
          totalAmount: null,
          paidAmount: '0.00',
          balanceAmount: null,
          methods: [],
          historicalMethod: null,
          payment: null,
        },
      });
    });
    await page.route(
      '**/api/v1/public/tenants/demo/establishments/la-bahia/reservations',
      async (route) => {
        payload = route.request().postDataJSON();
        expect(route.request().headers()['authorization']).toBeUndefined();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: RESERVATION_ID,
            establishmentId: ESTABLISHMENT_ID,
            spaceElementIds: [ELEMENT_ID],
            date: DATE,
            startTime: '19:00',
            endTime: '21:00',
            ...interval,
            timezone: 'America/La_Paz',
            status: 'CREATED',
            createdAt: '2030-12-20T12:00:00Z',
            accessToken: ACCESS_TOKEN,
            accessExpiresAt: '2030-12-26T01:00:00Z',
          }),
        });
      },
    );

    await page.goto(BOOKING_URL);
    await expect(page.getByTestId('booking-descriptor')).toContainText('Mesa Terraza');
    await expect(page.getByLabel('Nombre completo')).toHaveCount(0);
    await page.getByTestId('booking-confirm').click();
    await page.getByLabel('Nombre completo').fill('Ana Pérez');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+591 70000000');
    await page.getByRole('button', { name: 'Crear reserva', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Reserva registrada' })).toBeVisible();
    await expect(page.getByText(RESERVATION_ID)).toBeVisible();
    await expect(page.getByTestId('booking-own-space')).toContainText('Mesa Terraza');
    await expect(page.getByTestId('booking-own-space')).toContainText('Planta baja · Terraza');
    await expect(page.getByText(/19:00.*21:00/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(RESERVATION_ID, { exact: true })).toBeVisible();
    await expect(page.getByTestId('booking-own-space')).toContainText('Mesa Terraza');
    await expect(page).not.toHaveURL(/login/);
    expect(payload).toMatchObject({
      date: DATE,
      startTime: '19:00',
      endTime: '21:00',
      spaceElementIds: [ELEMENT_ID],
      customer: {
        fullName: 'Ana Pérez',
        email: 'ana@example.com',
        phone: '+591 70000000',
      },
    });
  });

  test('muestra un conflicto de disponibilidad sin perder el formulario', async ({ page }) => {
    await page.route(
      '**/api/v1/public/tenants/demo/establishments/la-bahia/reservations',
      (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://mapit.dev/problems/reservation-overlap',
            title: 'Elementos no disponibles',
            status: 409,
            detail: 'Existen elementos reservados durante el intervalo solicitado',
          }),
        }),
    );

    await page.goto(BOOKING_URL);
    await page.getByTestId('booking-confirm').click();
    await page.getByLabel('Nombre completo').fill('Ana Pérez');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+591 70000000');
    await page.getByRole('button', { name: 'Crear reserva', exact: true }).click();

    await expect(page.getByTestId('booking-error')).toContainText('ya no está disponible');
    await expect(page.getByTestId('booking-confirm')).toBeEnabled();
    await page.getByTestId('booking-confirm').click();
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Ana Pérez');
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('ana@example.com');
    await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue('+591 70000000');
    await expect(page.getByRole('button', { name: 'Crear reserva', exact: true })).toBeEnabled();
  });
});
