import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * HU-3.02 / MAP-151: latencia extremo a extremo del cambio de estado en tiempo real.
 *
 * Flujo real: PATCH de estado (HU-3.01) → outbox → dispatcher → STOMP → cliente Angular →
 * `data-state` de la fila en la vista del sector. Los datos se siembran por la API real, como en
 * `activation.spec.ts`.
 *
 * Puntos de medición (mismo reloj, el del navegador, con `performance.now()`):
 *   t0 = justo antes de enviar el PATCH (fetch desde la página, fuera de la app: la vista no sabe
 *        que hubo un cambio, solo se entera por el WebSocket).
 *   t1 = el MutationObserver ve el nuevo `data-state` en la celda del elemento.
 *
 * Criterio (spec CA-9/CA-10): todas las muestras llegan y p95 < 2000 ms. Sin esperas fijas: cada
 * muestra termina en cuanto el DOM cambia; el tope de 5 s solo corta una muestra perdida.
 *
 * Requiere el stack completo (`pnpm dev`) con la flag `realtime.websocket` activa.
 */
const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
const SUPER_EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const SUPER_PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';
const ADMIN_PASSWORD = 'S3cur3?P4ss!';

const SAMPLES = Number(process.env['E2E_LATENCY_SAMPLES'] ?? 20);
const THRESHOLD_MS = 2000;
const SAMPLE_TIMEOUT_MS = 5000;

interface Seed {
  tenantSlug: string;
  adminEmail: string;
  token: string;
  establishmentId: string;
  sectorId: string;
  elementId: string;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  const detail = response.ok() ? '' : await response.text();
  expect(response.ok(), `${response.url()} → ${response.status()} ${detail}`).toBeTruthy();
  return (await response.json()) as T;
}

/** Tenant + ADMIN activado + establecimiento, planta, sector y un elemento AVAILABLE. */
async function seed(request: APIRequestContext): Promise<Seed> {
  const run = Date.now().toString(36).slice(-6);
  const tenantSlug = `e2e-rt-${run}`;
  const adminEmail = `admin-rt-${run}@mapit.test`;

  const superLogin = await json<{ accessToken: string }>(
    await request.post(`${API}/auth/login`, {
      data: { tenantSlug: 'platform', email: SUPER_EMAIL, password: SUPER_PASSWORD },
    }),
  );
  const created = await request.post(`${API}/tenants`, {
    headers: { Authorization: `Bearer ${superLogin.accessToken}` },
    data: {
      name: `Tiempo real ${run}`,
      slug: tenantSlug,
      vertical: 'RESTAURANT',
      administratorEmail: adminEmail,
    },
  });
  expect(created.status()).toBe(201);

  interface MxList {
    messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
  }
  let messageId = '';
  await expect(async () => {
    const inbox = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as MxList;
    messageId = inbox.messages?.find((m) => m.To?.[0]?.Address === adminEmail)?.ID ?? '';
    expect(messageId, 'no llegó el correo de invitación').not.toBe('');
  }).toPass({ timeout: 10_000 });
  const mail = (await (await request.get(`${MAILPIT}/api/v1/message/${messageId}`)).json()) as {
    Text?: string;
  };
  const rawToken = (mail.Text ?? '').match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(rawToken, 'el correo no contiene el token de activación').toBeTruthy();

  const activated = await request.post(`${API}/auth/activate`, {
    data: {
      tenantSlug,
      token: rawToken,
      password: ADMIN_PASSWORD,
      passwordConfirm: ADMIN_PASSWORD,
    },
  });
  expect(activated.ok(), `activate → ${activated.status()}`).toBeTruthy();

  const { accessToken: token } = await json<{ accessToken: string }>(
    await request.post(`${API}/auth/login`, {
      data: { tenantSlug, email: adminEmail, password: ADMIN_PASSWORD },
    }),
  );
  const auth = { Authorization: `Bearer ${token}` };

  const establishment = await json<{ id: string }>(
    await request.post(`${API}/establishments`, {
      headers: auth,
      data: { name: `Local ${run}`, type: 'RESTAURANT', slug: `local-${run}` },
    }),
  );
  const floor = await json<{ id: string }>(
    await request.post(`${API}/establishments/${establishment.id}/floors`, {
      headers: auth,
      data: { name: 'Planta baja', level: 1 },
    }),
  );
  const sector = await json<{ id: string }>(
    await request.post(`${API}/floors/${floor.id}/sectors`, {
      headers: auth,
      data: { name: 'Salón', slug: `salon-${run}` },
    }),
  );
  const element = await json<{ id: string }>(
    await request.post(`${API}/sectors/${sector.id}/elements`, {
      headers: auth,
      data: { type: 'TABLE', x: 10, y: 20 },
    }),
  );

  return {
    tenantSlug,
    adminEmail,
    token,
    establishmentId: establishment.id,
    sectorId: sector.id,
    elementId: element.id,
  };
}

test.describe('HU-3.02 — visualización en tiempo real', () => {
  test('la vista refleja el cambio de estado por WebSocket en menos de 2 s (p95)', async ({
    page,
    request,
  }, testInfo) => {
    // Una sola corrida, en escritorio: la latencia no depende del viewport.
    test.skip(testInfo.project.name !== 'console', 'solo en el proyecto de escritorio');
    test.setTimeout(120_000);
    const data = await seed(request);

    // Sesión de la vista: el ADMIN entra por la consola y abre el sector.
    await page.goto(`/empresa/${data.tenantSlug}/login`);
    await page.getByLabel(/correo electr/i).fill(data.adminEmail);
    await page.locator('#password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /iniciar sesi/i }).click();
    await expect(page).toHaveURL(/\/home|\/admin/, { timeout: 15_000 });

    await page.goto(
      `/spaces/sectors/${data.sectorId}/elements?establishmentId=${data.establishmentId}`,
    );
    const stateCell = page
      .locator(`[data-testid="space-element-row"][data-element-id="${data.elementId}"]`)
      .getByTestId('space-element-state');
    await expect(stateCell).toHaveAttribute('data-state', 'AVAILABLE');
    // Sin sala en vivo la medición no tendría sentido (mediría el sondeo de respaldo).
    await expect(page.getByTestId('live-status')).toHaveAttribute('data-live', 'live');

    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const target = i % 2 === 0 ? 'OCCUPIED' : 'AVAILABLE';
      const elapsed = await page.evaluate(
        async ({ api, token, sectorId, elementId, state, timeoutMs }) => {
          const selector = `[data-testid="space-element-row"][data-element-id="${elementId}"] [data-testid="space-element-state"]`;
          const cell = document.querySelector(selector);
          if (!cell) throw new Error('no se encontró la celda del elemento');
          const seen = new Promise<number>((resolve, reject) => {
            const observer = new MutationObserver(() => {
              if (cell.getAttribute('data-state') === state) {
                observer.disconnect();
                resolve(performance.now());
              }
            });
            observer.observe(cell, { attributes: true, attributeFilter: ['data-state'] });
            setTimeout(() => {
              observer.disconnect();
              reject(new Error(`sin evento en ${timeoutMs} ms`));
            }, timeoutMs);
          });
          const t0 = performance.now();
          const response = await fetch(`${api}/sectors/${sectorId}/elements/${elementId}/state`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ state }),
          });
          if (!response.ok) throw new Error(`PATCH respondió ${response.status}`);
          return (await seen) - t0;
        },
        {
          api: API,
          token: data.token,
          sectorId: data.sectorId,
          elementId: data.elementId,
          state: target,
          timeoutMs: SAMPLE_TIMEOUT_MS,
        },
      );
      samples.push(Math.round(elapsed));
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const result = {
      samples: samples.length,
      thresholdMs: THRESHOLD_MS,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted[sorted.length - 1],
      min: sorted[0],
      mean: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
      raw: samples,
    };
    await testInfo.attach('latencia-hu-3.02.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    console.log(`[HU-3.02] latencia e2e (ms): ${JSON.stringify(result)}`);

    expect(result.samples).toBe(SAMPLES);
    expect(result.p95, `p95 ${result.p95} ms ≥ ${THRESHOLD_MS} ms`).toBeLessThan(THRESHOLD_MS);
  });
});
