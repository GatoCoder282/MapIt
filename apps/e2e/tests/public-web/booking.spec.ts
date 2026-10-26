import { expect, test } from '@playwright/test';

const RESERVATION_ID = '40000000-0000-0000-0000-000000000001';
const ELEMENT_ID = '20000000-0000-0000-0000-000000000001';
const BOOKING_URL = `/reservar/demo/la-bahia/${ELEMENT_ID}?date=2026-10-25`;

test.describe('Reserva pública', () => {
  test('confirma una reserva anónima y muestra el código', async ({ page }) => {
    let payload: unknown;
    await page.route(
      '**/api/v1/public/tenants/demo/establishments/la-bahia/reservations',
      async (route) => {
        payload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: RESERVATION_ID,
            establishmentId: '10000000-0000-0000-0000-000000000001',
            spaceElementIds: [ELEMENT_ID],
            date: '2026-10-25',
            startTime: '19:00',
            endTime: '21:00',
            startsAt: '2026-10-25T23:00:00Z',
            endsAt: '2026-10-26T01:00:00Z',
            timezone: 'America/La_Paz',
            status: 'CREATED',
            createdAt: '2026-10-20T12:00:00Z',
          }),
        });
      },
    );

    await page.goto(BOOKING_URL);
    await page.getByLabel('Nombre completo').fill('Ana Pérez');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+591 70000000');
    await page.getByLabel('Hora de inicio').fill('19:00');
    await page.getByLabel('Hora de fin').fill('21:00');
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();

    await expect(page.getByRole('heading', { name: 'Reserva confirmada' })).toBeVisible();
    await expect(page.getByText(RESERVATION_ID)).toBeVisible();
    await expect(page.getByText(/19:00.21:00/)).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
    expect(payload).toMatchObject({
      date: '2026-10-25',
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
    await page.getByLabel('Nombre completo').fill('Ana Pérez');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByLabel('Hora de inicio').fill('19:00');
    await page.getByLabel('Hora de fin').fill('21:00');
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();

    await expect(page.getByRole('alert')).toContainText('ya no está disponible');
    await expect(page.getByRole('button', { name: 'Confirmar reserva' })).toBeEnabled();
  });
});
