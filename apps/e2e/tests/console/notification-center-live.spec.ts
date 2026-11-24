import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  api,
  center,
  fixture,
  prepareFlags,
  sql,
  toggle,
} from './notification-center-live-fixture';

test.skip(
  !process.env['MAP286_QA_CONTAINER'],
  'Requiere stack QA temporal verificado con V40–V42 antes de V43–V45',
);

test('centro real: emisión, dos sesiones, lectura, reconexión, preferencias, rollback y check-in', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const data = await fixture(request);
  const restore = await prepareFlags();
  const secondContext = await browser.newContext({
    viewport: page.viewportSize(),
    isMobile: testInfo.project.name.endsWith('mobile'),
    hasTouch: testInfo.project.name.endsWith('mobile'),
  });
  const second = await secondContext.newPage();
  async function observeSockets(target: Page) {
    await target.addInitScript(() => {
      const Native = window.WebSocket;
      const probe = { sockets: [] as WebSocket[], subscriptions: 0, duplicates: 0 };
      (window as Window & { __map286QA?: typeof probe }).__map286QA = probe;
      class Observed extends Native {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          if (this.url.endsWith('/ws')) probe.sockets.push(this);
          const send = this.send.bind(this);
          this.send = (data) => {
            if (
              typeof data === 'string' &&
              data.startsWith('SUBSCRIBE') &&
              data.includes('/user/topic/notifications')
            )
              probe.subscriptions++;
            send(data);
          };
          let replaying = false;
          this.addEventListener('message', (event) => {
            if (
              !replaying &&
              typeof event.data === 'string' &&
              event.data.includes('notification.inbox.invalidated.v1')
            ) {
              replaying = true;
              probe.duplicates++;
              this.dispatchEvent(new MessageEvent('message', { data: event.data }));
              replaying = false;
            }
          });
        }
      }
      window.WebSocket = Observed;
    });
  }
  const stats = (target: Page) =>
    target.evaluate(() => {
      const value = (
        window as Window & { __map286QA?: { subscriptions: number; duplicates: number } }
      ).__map286QA;
      if (!value) throw new Error('WebSocket QA observer not installed');
      return { subscriptions: value.subscriptions, duplicates: value.duplicates };
    });
  await observeSockets(page);
  await observeSockets(second);
  async function login(target: Page) {
    await target.addInitScript(
      ({ tenant, user, venue }) =>
        localStorage.setItem('mapit.establishment.' + tenant + '.' + user, venue),
      { tenant: data.tenant, user: data.user, venue: data.venue },
    );
    await target.goto('/login');
    await target.getByTestId('login-email').fill(data.email);
    await target.getByTestId('login-password').fill(data.password);
    await target.getByTestId('login-submit').click();
    await expect(target).toHaveURL(/\/home$/, { timeout: 30000 });
  }
  const bell = (target: Page) => target.getByRole('button', { name: /^Notificaciones(?::|$)/ });
  const panel = (target: Page) =>
    target.getByRole('dialog', { name: 'Notificaciones', exact: true });
  const unread = async () => {
    const r = await request.get(api + '/me/notifications/unread-count', { headers: data.headers });
    return r.status() === 200 ? ((await r.json()) as { unreadCount: number }).unreadCount : -1;
  };
  const status = async () =>
    (await request.get(api + '/me/notifications', { headers: data.headers })).status();
  async function open(target: Page) {
    if (!(await panel(target).isVisible())) await bell(target).click();
    await expect(panel(target)).toBeVisible();
  }
  try {
    await toggle(center, false);
    await toggle('realtime.websocket', true);
    await login(page);
    await login(second);
    await expect.poll(status, { timeout: 60000 }).toBe(404);
    await expect(bell(page)).toHaveCount(0);
    await data.reserve();
    await expect
      .poll(() =>
        Number(
          sql(
            `select count(*) from notification where tenant_id='${data.tenant}' and recipient_user_id='${data.user}'`,
          ),
        ),
      )
      .toBe(1);
    await toggle(center, true);
    await expect.poll(status, { timeout: 60000 }).toBe(200);
    await expect(bell(page)).toBeVisible({ timeout: 60000 });
    await expect(bell(second)).toBeVisible({ timeout: 60000 });
    await expect
      .poll(async () => (await stats(page)).subscriptions, { timeout: 30000 })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => (await stats(second)).subscriptions, { timeout: 30000 })
      .toBeGreaterThanOrEqual(1);
    await open(page);
    await open(second);
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(1);
    await data.reserve();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(2);
    await expect(panel(second).getByRole('heading', { level: 3 })).toHaveCount(2);
    expect((await stats(page)).duplicates).toBeGreaterThan(0);
    await panel(page)
      .getByRole('button', { name: 'Marcar como leída', exact: true })
      .first()
      .click();
    await expect(
      panel(second).getByRole('button', { name: 'Marcar como leída', exact: true }),
    ).toHaveCount(1);
    await panel(second)
      .getByRole('button', { name: 'Marcar todas como leídas', exact: true })
      .click();
    await expect.poll(unread).toBe(0);
    await expect(
      panel(page).getByRole('button', { name: 'Marcar como leída', exact: true }),
    ).toHaveCount(0);
    const staffRows = await request.get(api + '/me/notifications', {
      headers: { Authorization: 'Bearer ' + data.staffAuth.accessToken },
    });
    const staffItems = (await staffRows.json()) as { content: { id: string }[] };
    expect(staffItems.content).toHaveLength(2);
    expect(
      (
        await request.patch(api + '/me/notifications/' + staffItems.content[0]!.id + '/read', {
          headers: data.headers,
        })
      ).status(),
    ).toBe(404);
    const otherRows = await request.get(api + '/me/notifications', {
      headers: { Authorization: 'Bearer ' + data.otherAuth.accessToken },
    });
    expect(((await otherRows.json()) as { content: unknown[] }).content).toEqual([]);
    expect(
      (
        await request.get(api + '/me/notifications?userId=' + data.staff, { headers: data.headers })
      ).status(),
    ).toBe(400);
    const before = (await stats(page)).subscriptions;
    await page.context().setOffline(true);
    await page.evaluate(() => {
      const probe = (window as Window & { __map286QA?: { sockets: WebSocket[] } }).__map286QA;
      if (!probe) throw new Error('WebSocket QA observer not installed');
      for (const socket of probe.sockets)
        if (socket.readyState === WebSocket.OPEN) socket.close(3001, 'QA reconnect');
    });
    await data.reserve();
    await expect
      .poll(() =>
        Number(sql(`select count(*) from notification where recipient_user_id='${data.user}'`)),
      )
      .toBe(3);
    await page.context().setOffline(false);
    await expect
      .poll(async () => (await stats(page)).subscriptions, { timeout: 30000 })
      .toBeGreaterThan(before);
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(3);
    await panel(page).getByTestId('notification-preferences-toggle').click();
    await panel(page).getByRole('checkbox', { name: 'Reservas', exact: true }).uncheck();
    await panel(page).getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
    await expect(
      panel(page).getByRole('status').filter({ hasText: 'Preferencias guardadas.' }),
    ).toBeVisible();
    const skipped = await data.reserve();
    await expect
      .poll(() =>
        Number(
          sql(
            `select count(*) from notification_event_outbox where reservation_id='${skipped.id}' and processed_at is not null`,
          ),
        ),
      )
      .toBe(1);
    expect(
      Number(sql(`select count(*) from notification where recipient_user_id='${data.user}'`)),
    ).toBe(3);
    await panel(page).getByRole('checkbox', { name: 'Reservas', exact: true }).check();
    await panel(page).getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
    await expect(
      panel(page).getByRole('status').filter({ hasText: 'Preferencias guardadas.' }),
    ).toBeVisible();
    await data.reserve();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(bell(page)).toBeFocused();
    await expect(panel(page)).toHaveCount(0);
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const bounds = await panel(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await panel(page).screenshot({ path: testInfo.outputPath('notification-panel.png') });
    const state = sql(
      `select count(*)||':'||count(read_at) from notification where recipient_user_id='${data.user}'`,
    );
    await toggle(center, false);
    await expect.poll(status, { timeout: 60000 }).toBe(404);
    await expect(bell(page)).toHaveCount(0, { timeout: 60000 });
    expect(
      sql(
        `select count(*)||':'||count(read_at) from notification where recipient_user_id='${data.user}'`,
      ),
    ).toBe(state);
    await toggle(center, true);
    await expect.poll(status, { timeout: 60000 }).toBe(200);
    await expect(bell(page)).toBeVisible({ timeout: 60000 });
    await open(page);
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(4);
    // Delay a real response, then inject a network failure; no invented HTTP data.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached = false;
    await page.route(/\/me\/notifications(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      reached = true;
      await gate;
      await route.fulfill({ response });
    });
    await panel(page).getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect.poll(() => reached).toBe(true);
    await expect(
      panel(page).getByRole('status').filter({ hasText: 'Cargando notificaciones' }),
    ).toBeVisible();
    release();
    await page.unrouteAll({ behavior: 'wait' });
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(4);
    await page.route(/\/me\/notifications(?:\?.*)?$/, (route) => route.abort('failed'));
    await panel(page).getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect(
      panel(page).getByRole('alert').filter({ hasText: 'No se pudieron cargar' }),
    ).toBeVisible();
    await page.unroute(/\/me\/notifications(?:\?.*)?$/);
    await panel(page).getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(4);
    // Reserva pública, dinero simulado por el proveedor existente y check-in HTTP/UI reales.
    expect(
      (
        await request.put(api + '/establishments/' + data.venue + '/payment-policy', {
          headers: data.headers,
          data: {
            enabled: true,
            currency: 'BOB',
            depositAmount: '120.00',
            totalAmount: '400.00',
            paymentWindowMinutes: 30,
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.post(api + '/payment-methods/mock-qr', {
          headers: data.headers,
          data: {
            establishmentId: data.venue,
            country: 'BO',
            bankName: 'QA sin dinero',
            accountReference: 'QA',
            accountHolderName: 'QA',
            enabled: true,
          },
        })
      ).status(),
    ).toBe(201);
    const method = sql(
      `select id from merchant_payment_method where tenant_id='${data.tenant}' and establishment_id='${data.venue}' and mock_qr_configuration_id is not null and superseded_at is null`,
    );
    const base = api + '/public/tenants/' + data.tenant + '/establishments/sede';
    const arrivalStart = new Date(Math.ceil((Date.now() + 15 * 60000) / 900000) * 900000);
    const arrivalEnd = new Date(arrivalStart.getTime() + 60 * 60000);
    const publicBooking = await request.post(base + '/reservations', {
      data: {
        date: arrivalStart.toISOString().slice(0, 10),
        startTime: arrivalStart.toISOString().slice(11, 16),
        endTime:
          arrivalEnd.toISOString().slice(0, 10) === arrivalStart.toISOString().slice(0, 10)
            ? arrivalEnd.toISOString().slice(11, 16)
            : '23:59',
        spaceElementIds: [data.element],
        customer: { fullName: 'Cliente QA', email: 'guest@map286.test' },
      },
    });
    expect(publicBooking.status()).toBe(201);
    const booking = (await publicBooking.json()) as { id: string; accessToken: string };
    const access = { 'X-Reservation-Access': booking.accessToken };
    const path = base + '/reservations/' + booking.id;
    const started = await request.post(path + '/payments', {
      headers: access,
      data: { methodId: method, requestId: randomUUID() },
    });
    expect(started.status()).toBe(201);
    const payment = (await started.json()) as { id: string };
    expect(
      (
        await request.post(path + '/payments/' + payment.id + '/simulate', {
          headers: access,
          data: { outcome: 'CONFIRMED', eventId: randomUUID() },
        })
      ).ok(),
    ).toBe(true);
    const issued = await request.post(path + '/receipt', { headers: access });
    expect(issued.status()).toBe(201);
    const receipt = (await issued.json()) as { token: string };
    await page.goto('/check-in');
    await page.getByTestId('check-in-manual-mode').click();
    await page.getByTestId('check-in-code').fill(receipt.token);
    await page.getByTestId('lookup-receipt').click();
    await expect(page.getByTestId('register-arrival')).toBeEnabled();
    const registered = page.waitForResponse(
      (response) =>
        response.url() === api + '/establishments/' + data.venue + '/check-ins' &&
        response.request().method() === 'POST',
    );
    await page.getByTestId('register-arrival').click();
    expect((await registered).status()).toBe(200);
    await expect(page.getByTestId('register-arrival')).toBeDisabled();
    await open(page);
    await expect(
      panel(page).getByRole('heading', { name: 'Llegada registrada', exact: true }),
    ).toHaveCount(1);
    expect(
      (
        await request.post(api + '/establishments/' + data.venue + '/check-ins', {
          headers: data.headers,
          data: { token: receipt.token },
        })
      ).ok(),
    ).toBe(true);
    expect(
      Number(
        sql(
          `select count(*) from notification_event_outbox where reservation_id='${booking.id}' and event_type='RESERVATION_CHECKED_IN'`,
        ),
      ),
    ).toBe(1);
  } finally {
    await expect
      .poll(
        async () => {
          try {
            await restore();
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 60000 },
      )
      .toBe(true);
    await secondContext.close();
  }
});
