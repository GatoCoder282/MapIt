import { expect, test } from '@playwright/test';
import type { MockQrConfiguration } from '../../../../libs/api-client/src/lib/generated/model/mock-qr-configuration';
import { readFileSync } from 'node:fs';
import { fixtureFile, type LiveFixture } from './setup';

test.use({ hasTouch: true });

test('selectores QR → guardar UUID e ISO reales → recargar → editar y regenerar', async ({
  page,
}) => {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as LiveFixture;
  const endpoint = fixture.api + '/payment-methods/mock-qr';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/assets/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: fixture.api,
        paymentPublicOrigin: 'http://localhost:4500',
        environment: 'development',
        unleashProxyUrl: '',
        unleashClientKey: '',
      },
    }),
  );
  await page.addInitScript((session) => {
    sessionStorage.setItem('mapit.auth.session', JSON.stringify(session));
  }, fixture.session);
  await page.goto('http://localhost:4400/administration/settings/payment-methods');

  const venue = page.getByRole('combobox', { name: 'Establecimiento', exact: true });
  const country = page.getByRole('combobox', { name: 'País', exact: true });
  const save = page.getByRole('button', { name: 'Guardar configuración', exact: true });
  await expect(venue).toBeEnabled();
  await page.getByRole('button', { name: 'Nueva configuración', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^(Establecimiento|País)$/ })).toHaveCount(2);
  await venue.fill('Centro 10');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('Navegador — Centro');
  await venue.press('ArrowDown');
  await venue.press('Enter');
  await expect(venue).toHaveValue('Navegador — Centro');
  await expect(venue).toHaveAttribute('aria-expanded', 'false');
  await country.fill('BO');
  await page.getByRole('option', { name: 'Bolivia (BO)', exact: true }).click();
  await page.getByLabel('Banco', { exact: true }).fill('Banco de prueba');
  await page.getByLabel('Titular de la cuenta', { exact: true }).fill('Titular simulado');
  await page.getByLabel('Referencia de cuenta', { exact: true }).fill('REFERENCIA-DEMO');
  const createdResponse = page.waitForResponse(
    (response) => response.url() === endpoint && response.request().method() === 'POST',
  );
  await save.click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  expect(created.request().postDataJSON()).toMatchObject({
    establishmentId: fixture.otherVenue,
    country: 'BO',
    bankName: 'Banco de prueba',
  });
  const configuration = (await created.json()) as MockQrConfiguration;
  await expect(page.getByRole('img', { name: /QR de prueba de MapIt/ })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /^Navegador — Centro/ }).click();
  await expect(venue).toHaveValue('Navegador — Centro');
  await expect(country).toHaveValue('Bolivia (BO)');
  await expect(page.getByLabel('Referencia de cuenta', { exact: true })).toHaveValue(
    'REFERENCIA-DEMO',
  );
  await country.fill('peru');
  await expect(page.getByRole('option')).toHaveCount(1);
  await country.press('Escape');
  await expect(save).toBeDisabled();
  await country.fill('peru');
  await country.press('Enter');
  const updatedResponse = page.waitForResponse(
    (response) =>
      response.url() === endpoint + '/' + configuration.id && response.request().method() === 'PUT',
  );
  await save.click();
  expect((await updatedResponse).status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: /^Navegador — Centro/ }).click();
  await expect(country).toHaveValue('Perú (PE)');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /^Navegador — Centro/ }) })
    .getByRole('button', { name: 'Desactivar', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Activar', exact: true })).toBeVisible();
  const regeneratedResponse = page.waitForResponse(
    (response) => response.url() === endpoint + '/' + configuration.id + '/regenerate',
  );
  await page.getByRole('button', { name: 'Regenerar QR', exact: true }).click();
  const regenerated = (await (await regeneratedResponse).json()) as MockQrConfiguration;
  expect(regenerated.simulationToken).not.toBe(configuration.simulationToken);
  await expect(page.getByRole('img', { name: /QR de prueba de MapIt/ })).toBeVisible();
  await country.click();
  await country.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await venue.tap();
  await expect(page.getByRole('option', { name: /Navegador — Centro/ })).toBeVisible();
  await page.getByRole('option', { name: /Navegador — Centro/ }).tap();
  await expect(venue).toHaveValue('Navegador — Centro');
  await expect(venue).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});
