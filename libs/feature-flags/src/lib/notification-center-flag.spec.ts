import { TestBed } from '@angular/core/testing';
import { Logger } from '@mapit/logging';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FeatureFlagService } from './feature-flag.service';
import { provideFeatureFlags } from './feature-flag.config';
import type { FeatureFlagContext } from './feature-flag.context';

const FLAG = 'mapit.s6.notification-center';
const A: FeatureFlagContext = {
  tenantId: 'tenant-a',
  userId: '00000000-0000-0000-0000-000000000001',
  sessionId: 'session-a',
};
const B: FeatureFlagContext = { ...A, tenantId: 'tenant-b', sessionId: 'session-b' };
const response = (toggles: unknown) => new Response(JSON.stringify({ toggles }), { status: 200 });
const enabled = () =>
  response([
    { name: FLAG, enabled: true },
    { name: 'payments.qr', enabled: true },
    { name: 'realtime.websocket', enabled: true },
  ]);
const settle = () => vi.advanceTimersByTimeAsync(0);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset().mockImplementation(() => Promise.resolve(enabled()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function service(proxyUrl = 'https://flags.example/proxy'): FeatureFlagService {
  TestBed.configureTestingModule({
    providers: [
      provideFeatureFlags({ proxyUrl, clientKey: 'public-proxy-key', intervaloRefrescoMs: 1_000 }),
      { provide: Logger, useValue: { log: vi.fn() } },
    ],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  return flags;
}

it('OFF sin contexto aunque la respuesta global anuncie ON; ON solo tras evaluación contextual', async () => {
  const flags = service();
  const state = flags.isEnabled(FLAG);
  await settle();
  expect(state()).toBe(false);
  flags.setContext(A);
  expect(state()).toBe(false);
  await settle();
  expect(state()).toBe(true);
  const call = fetchMock.mock.calls.find(
    ([input]) => typeof input === 'string' && input.includes('?'),
  );
  expect(call).toBeDefined();
  const input = call?.[0];
  if (typeof input !== 'string') throw new Error('Expected contextual URL');
  const url = new URL(input);
  expect(url.searchParams.get('properties[tenantId]')).toBe(A.tenantId);
  expect(url.searchParams.get('userId')).toBe(A.userId);
  expect(url.searchParams.get('sessionId')).toBe(A.sessionId);
  expect(call?.[1]?.headers).toEqual({ Authorization: 'public-proxy-key' });
  expect(call?.[1]?.credentials).toBe('omit');
  flags.setContext(null);
  expect(state()).toBe(false);
  expect(flags.isEnabledNow(FLAG)).toBe(false);
});

it('sin proveedor permanece OFF y no realiza peticiones', async () => {
  const flags = service('');
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('no reutiliza ON para una identidad nueva antes de actualizar el contexto del proveedor', async () => {
  const flags = service();
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledForContext(FLAG, A)).toBe(true);
  expect(flags.isEnabledForContext(FLAG, { ...A, sessionId: 'new-login' })).toBe(false);
  expect(flags.isEnabledForContext(FLAG, B)).toBe(false);
  expect(flags.isEnabledForContext(FLAG, null)).toBe(false);
});

it('campos ausentes en un contexto de runtime no se convierten en strings válidos', async () => {
  const flags = service();
  flags.setContext({ ...A, sessionId: undefined } as unknown as FeatureFlagContext);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(false);
  expect(
    fetchMock.mock.calls.every(([input]) => typeof input === 'string' && !input.includes('?')),
  ).toBe(true);
});

it('error después de ON cierra el centro y preserva el comportamiento de otros flags', async () => {
  const flags = service();
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(true);
  expect(flags.isEnabledNow('payments.qr')).toBe(true);
  fetchMock.mockRejectedValue(new Error('private-canary'));
  await vi.advanceTimersByTimeAsync(1_000);
  expect(flags.isEnabledNow(FLAG)).toBe(false);
  expect(flags.isEnabledNow('payments.qr')).toBe(true);
  expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
  fetchMock.mockImplementation(() => Promise.resolve(enabled()));
  await vi.advanceTimersByTimeAsync(1_000);
  expect(flags.isEnabledNow(FLAG)).toBe(true);
});

it.each([
  [],
  [{ name: 'other.flag', enabled: true }],
  [{ name: FLAG, enabled: 'true' }],
  [
    { name: FLAG, enabled: true },
    { name: FLAG, enabled: false },
  ],
  [{ name: FLAG, enabled: true }, { name: FLAG }],
  null,
])('flag ausente o respuesta inválida no conserva ON: %j', async (toggles) => {
  const flags = service();
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(true);
  fetchMock.mockImplementation(() => Promise.resolve(response(toggles)));
  await vi.advanceTimersByTimeAsync(1_000);
  expect(flags.isEnabledNow(FLAG)).toBe(false);
});

it('HTTP no exitoso o contexto inválido falla cerrado', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 503 })));
  const flags = service();
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(false);
  fetchMock.mockImplementation(() => Promise.resolve(enabled()));
  flags.setContext({ ...A, sessionId: 'jwt.payload.signature' });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(flags.isEnabledNow(FLAG)).toBe(false);
});

it('cambia tenant, usuario y sesión sin reutilizar el ON anterior', async () => {
  const flags = service();
  flags.setContext(A);
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(true);
  fetchMock.mockImplementation(() => Promise.resolve(response([])));
  for (const next of [
    B,
    { ...B, userId: '00000000-0000-0000-0000-000000000002' },
    { ...A, sessionId: 'new-login' },
  ]) {
    flags.setContext(next);
    expect(flags.isEnabledNow(FLAG)).toBe(false);
    await settle();
    expect(flags.isEnabledNow(FLAG)).toBe(false);
  }
});

it('una respuesta de A no se aplica tras A → B → A o logout', async () => {
  let finish: ((value: Response) => void) | undefined;
  const flags = service();
  await settle();
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  flags.setContext(A);
  flags.setContext(B);
  flags.setContext(null);
  fetchMock.mockImplementation(() => Promise.resolve(response([])));
  flags.setContext(A);
  await settle();
  finish?.(enabled());
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(false);
});

it('descarta errores tardíos de una evaluación anterior a un ON más reciente', async () => {
  let fail: ((error: Error) => void) | undefined;
  const flags = service();
  await settle();
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((_, reject) => {
        fail = reject;
      }),
  );
  flags.setContext(A);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(flags.isEnabledNow(FLAG)).toBe(true);
  fail?.(new Error('old-evaluation'));
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(true);
});

it('timeout descarta incluso un proveedor que ignora abort y responde ON después', async () => {
  let finish: ((value: Response) => void) | undefined;
  const flags = service();
  await settle();
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  flags.setContext(A);
  // Detener sondeo sin destruir el servicio permite verificar el timeout de esa única evaluación.
  vi.clearAllTimers();
  flags.setContext(B);
  await vi.advanceTimersByTimeAsync(10_000);
  finish?.(enabled());
  await settle();
  expect(flags.isEnabledNow(FLAG)).toBe(false);
});
