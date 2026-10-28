import { expect, test } from '@playwright/test';

// Interval/form regression only. Real inventory/map/booking/payment lives in payment-live.
test('exige fecha y ambas horas antes de consultar el plano público', async ({ page }) => {
  const mapRequests: string[] = [];
  const authorization: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/availability/map')) mapRequests.push(request.url());
    if (request.url().includes('/public/') && request.headers()['authorization'])
      authorization.push(request.url());
  });
  await page.goto('/disponibilidad/demo/la-bahia');
  await expect(page.getByLabel('Fecha de reserva', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Hora de inicio', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Hora de fin', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Buscar espacios', exact: true }).click();
  await expect(page.getByTestId('availability-continue')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Plano/ })).toHaveCount(0);
  expect(mapRequests).toEqual([]);
  expect(authorization).toEqual([]);
  await expect(page).not.toHaveURL(/login/);
});
