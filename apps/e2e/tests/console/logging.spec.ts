import { expect, test } from '@playwright/test';

/** MAP-189: UI → API real → cabecera correlacionada → JSON del navegador. */
test('correlaciona un login rechazado sin registrar credenciales', async ({ page }) => {
  const logs: string[] = [];
  const externalHeaders: Array<Record<string, string>> = [];
  const sentinel = `private-${Date.now()}`;
  page.on('console', (message) => {
    if (message.text().startsWith('{')) logs.push(message.text());
  });
  page.on('request', (request) => {
    if (/\/assets\/|\/proxy(?:\?|$)/.test(request.url())) {
      externalHeaders.push(request.headers());
    }
  });

  await page.goto('/empresa/platform/login');
  await page.getByLabel(/correo electr/i).fill(`${sentinel}@example.invalid`);
  await page.getByRole('textbox', { name: /^contrase[ñn]a$/i }).fill(sentinel);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(401);
  const sentId = response.request().headers()['x-request-id'];
  expect(sentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(response.headers()['x-request-id']).toBe(sentId);
  await expect
    .poll(() =>
      logs
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .find((event) => event['request_id'] === sentId && event['status'] === 401),
    )
    .toBeTruthy();
  expect(logs.join('\n')).not.toContain(sentinel);
  expect(externalHeaders.length).toBeGreaterThan(0);
  for (const headers of externalHeaders) expect(headers['x-request-id']).toBeUndefined();
});
