import { TestBed } from '@angular/core/testing';
import { Logger } from '@mapit/logging';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { provideFeatureFlags } from './feature-flag.config';
import { FeatureFlagService } from './feature-flag.service';

const key = 'mapit.s6.my-account';
const response = (enabled: boolean) => ({
  ok: true,
  json: () => Promise.resolve({ toggles: [{ name: key, enabled }] }),
});
function setup(proxyUrl = 'http://localhost:3063/proxy') {
  TestBed.configureTestingModule({
    providers: [
      provideFeatureFlags({ proxyUrl, clientKey: 'proxy-key', intervaloRefrescoMs: 10000 }),
      { provide: Logger, useValue: { log: vi.fn() } },
    ],
  });
  return TestBed.inject(FeatureFlagService);
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('no consulta sin proxy y resuelve OFF', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const watched = setup('').watchInContext(key, { tenantId: 'tenant-a' });
  expect(watched.ready()).toBe(true);
  expect(watched.enabled()).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('envía el contexto al proxy con su clave pública, sin token de sesión', async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(true));
  vi.stubGlobal('fetch', fetchMock);
  const flags = setup();
  const watched = flags.watchInContext(key, { tenantId: 'tenant a&b' });
  expect(watched.ready()).toBe(false);
  expect(watched.enabled()).toBe(false);
  await vi.advanceTimersByTimeAsync(0);
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
  expect(new URL(url).searchParams.get('properties[tenantId]')).toBe('tenant a&b');
  expect(options.headers).toEqual({ Authorization: 'proxy-key' });
  expect(watched.ready()).toBe(true);
  expect(watched.enabled()).toBe(true);
  watched.destroy();
  expect(watched.enabled()).toBe(false);
});

it('vuelve a OFF tras fallo sin alterar el estado global de otras flags', async () => {
  let fail = false;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      if (fail) throw new Error('offline');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            toggles: [
              { name: key, enabled: true },
              { name: 'realtime.websocket', enabled: false },
            ],
          }),
      });
    }),
  );
  const flags = setup();
  TestBed.tick();
  const watched = flags.watchInContext(key, { tenantId: 'tenant-a' });
  await vi.advanceTimersByTimeAsync(0);
  expect(watched.enabled()).toBe(true);
  expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
  fail = true;
  await vi.advanceTimersByTimeAsync(10000);
  expect(watched.enabled()).toBe(false);
  expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
});

it.each([{}, { toggles: [] }, { toggles: [{ name: key, enabled: 'true' }] }])(
  'falla cerrado con respuesta incompleta o inválida: %j',
  async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }),
    );
    const watched = setup().watchInContext(key, { tenantId: 'a' });
    await vi.advanceTimersByTimeAsync(0);
    expect(watched.ready()).toBe(true);
    expect(watched.enabled()).toBe(false);
  },
);

it('ignora respuestas antiguas tras destruir el contexto o vencer el timeout', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  );
  const watched = setup().watchInContext(key, { tenantId: 'old' });
  await vi.advanceTimersByTimeAsync(5000);
  expect(watched.ready()).toBe(true);
  resolve(response(true));
  await vi.advanceTimersByTimeAsync(0);
  expect(watched.enabled()).toBe(false);
  watched.destroy();
  resolve(response(true));
  await vi.advanceTimersByTimeAsync(20000);
  expect(watched.enabled()).toBe(false);
});
