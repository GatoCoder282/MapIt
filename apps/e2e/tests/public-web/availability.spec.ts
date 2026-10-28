import { expect, test } from '@playwright/test';

const tomorrow = (): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

test.describe('Disponibilidad pública', () => {
  test('consulta espacios de forma anónima y presenta el resultado', async ({ page }) => {
    const date = tomorrow();
    await page.route(
      '**/api/v1/public/tenants/demo/establishments/la-bahia/availability*',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            establishmentId: '10000000-0000-0000-0000-000000000001',
            date,
            elements: [{ id: '20000000-0000-0000-0000-000000000001', type: 'TABLE' }],
          }),
        }),
    );

    await page.goto('/disponibilidad/demo/la-bahia');
    await page.getByLabel('Fecha de reserva').fill(date);
    await page.getByRole('button', { name: 'Buscar espacios' }).click();

    await expect(page.getByRole('heading', { name: 'Espacios disponibles' })).toBeVisible();
    await expect(page.getByText('Mesa', { exact: true })).toBeVisible();
    await expect(page.getByText('20000000-0000-0000-0000-000000000001')).toBeVisible();
    await expect(page).not.toHaveURL(/login/);

    await page.getByRole('link', { name: 'Reservar' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/reservar/demo/la-bahia/20000000-0000-0000-0000-000000000001\\?date=${date}`),
    );
    await expect(page.getByRole('heading', { name: 'Completa tu reserva' })).toBeVisible();
  });

  test('muestra el estado vacío cuando no hay espacios disponibles', async ({ page }) => {
    const date = tomorrow();
    await page.route(
      '**/api/v1/public/tenants/demo/establishments/la-bahia/availability*',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            establishmentId: '10000000-0000-0000-0000-000000000001',
            date,
            elements: [],
          }),
        }),
    );

    await page.goto('/disponibilidad/demo/la-bahia');
    await page.getByLabel('Fecha de reserva').fill(date);
    await page.getByRole('button', { name: 'Buscar espacios' }).click();

    await expect(
      page.getByText('No hay espacios disponibles para esta fecha. Prueba con otro día.'),
    ).toBeVisible();
  });
});
