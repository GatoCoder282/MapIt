import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@mapit/logging';
import { FLAGS_POR_DEFECTO, type FeatureFlagKey } from './feature-flag.catalog';
import {
  FEATURE_FLAG_CONFIG,
  provideFeatureFlags,
  type FeatureFlagContext,
} from './feature-flag.config';
import { FeatureFlagDirective } from './feature-flag.directive';
import { FeatureFlagService } from './feature-flag.service';

@Component({
  imports: [FeatureFlagDirective],
  template: `
    @if (flags.isEnabled('payments.qr')()) {
      <button>QR</button>
    }
    <span *featureFlag="'vertical.hotel'">Hotel</span>
    <span *featureFlag="'vertical.hotel'; else true">Sin hotel</span>
  `,
})
class FlagHost {
  protected readonly flags = inject(FeatureFlagService);
}

describe('FeatureFlagService con el contrato GET /proxy', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const context = signal<FeatureFlagContext>({});
  const log = vi.fn();
  const response = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) }) as Response;
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  };
  const start = () => {
    const flags = TestBed.inject(FeatureFlagService);
    TestBed.tick();
    return flags;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockResolvedValue(response({ toggles: [] }));
    log.mockReset();
    context.set({});
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [
        provideFeatureFlags({ intervaloRefrescoMs: 100, context: () => context() }),
        { provide: Logger, useValue: { log } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(
    (Object.keys(FLAGS_POR_DEFECTO) as FeatureFlagKey[]).filter(
      (key) => key !== 'mapit.s6.notification-center',
    ),
  )('%s cambia ON → ausente/OFF → ON sin reemplazar el Signal', async (key) => {
    fetchMock.mockResolvedValue(response({ toggles: [{ name: key, enabled: true }] }));
    const flags = start();
    const enabled = flags.isEnabled(key);
    await settle();
    expect(enabled()).toBe(true);
    expect(flags.listo()).toBe(true);
    fetchMock.mockResolvedValue(response({ toggles: [] }));
    await vi.advanceTimersByTimeAsync(100);
    expect(enabled()).toBe(false);
    expect(flags.isEnabledNow(key)).toBe(false);
    fetchMock.mockResolvedValue(response({ toggles: [{ name: key, enabled: true }] }));
    await vi.advanceTimersByTimeAsync(100);
    expect(flags.isEnabled(key)).toBe(enabled);
    expect(enabled()).toBe(true);
  });

  it('no habilita notificaciones desde una evaluación global sin sesión', async () => {
    const key = 'mapit.s6.notification-center';
    fetchMock.mockResolvedValue(response({ toggles: [{ name: key, enabled: true }] }));
    const flags = start();
    const enabled = flags.isEnabled(key);
    await settle();
    expect(flags.listo()).toBe(true);
    expect(enabled()).toBe(false);
    expect(flags.isEnabledNow(key)).toBe(false);
  });

  it.each([
    null,
    {},
    { toggles: {} },
    { toggles: [null] },
    { toggles: [{ name: 'payments.qr', enabled: 'false' }] },
    { toggles: [{ name: 12, enabled: true }] },
    { toggles: [{ name: 'payments.qr' }] },
    {
      toggles: [
        { name: 'payments.qr', enabled: true },
        { name: 'payments.qr', enabled: false },
      ],
    },
  ])('rechaza atómicamente el cuerpo inválido %j', async (body) => {
    const flags = start();
    await settle();
    fetchMock.mockResolvedValue(response(body));
    await vi.advanceTimersByTimeAsync(100);
    expect(flags.isEnabledNow('payments.qr')).toBe(false);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
    expect(log).toHaveBeenCalledWith('WARN', 'flags.degraded');
  });

  it('ignora claves desconocidas y acepta OFF explícito', async () => {
    fetchMock.mockResolvedValue(
      response({
        toggles: [
          { name: '__proto__', enabled: true },
          { name: 'unknown.flag', enabled: true },
          { name: 'payments.qr', enabled: false },
        ],
      }),
    );
    const flags = start();
    await settle();
    expect(flags.listo()).toBe(true);
    expect(flags.isEnabledNow('payments.qr')).toBe(false);
  });

  it('mantiene defaults al inicio, último estado válido en errores y recupera sin recargar', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    const flags = start();
    await settle();
    expect(flags.listo()).toBe(false);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
    fetchMock.mockResolvedValue(response({ toggles: [] }));
    await vi.advanceTimersByTimeAsync(100);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    await vi.advanceTimersByTimeAsync(200);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('json')),
    } as unknown as Response);
    await vi.advanceTimersByTimeAsync(100);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(false);
    fetchMock.mockResolvedValue(
      response({ toggles: [{ name: 'realtime.websocket', enabled: true }] }),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
    expect(log.mock.calls.filter(([level]) => level === 'WARN')).toHaveLength(2);
    expect(log.mock.calls.filter(([level]) => level === 'INFO')).toHaveLength(2);
  });

  it('no solapa solicitudes y aborta una conexión colgada para poder recuperarse', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const flags = start();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const pendingSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    fetchMock.mockResolvedValue(response({ toggles: [] }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pendingSignal?.aborted).toBe(true);
    expect(flags.listo()).toBe(true);
  });

  it('invalida respuestas de otra sesión/establecimiento y no envía JWT ni cookies', async () => {
    let oldResponse!: (value: Response) => void;
    context.set({
      userId: 'user-a',
      properties: { tenantId: 'tenant-a', establishmentId: 'est-a' },
    });
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResponse = resolve;
        }),
    );
    const flags = start();
    const oldSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    context.set({
      userId: 'user-b',
      properties: { tenantId: 'tenant-b', establishmentId: 'est-b' },
    });
    TestBed.tick();
    await settle();
    expect(oldSignal?.aborted).toBe(true);
    oldResponse(response({ toggles: [{ name: 'payments.qr', enabled: true }] }));
    await settle();
    expect(flags.isEnabledNow('payments.qr')).toBe(false);
    const [url, options] = fetchMock.mock.calls[1]!;
    expect(typeof url).toBe('string');
    const params = new URL(url as string).searchParams;
    expect(params.get('userId')).toBe('user-b');
    expect(params.get('properties[tenantId]')).toBe('tenant-b');
    expect(params.get('properties[establishmentId]')).toBe('est-b');
    expect(options?.headers).toEqual({ Authorization: 'dev-proxy-key-change-me' });
    expect(options?.credentials).toBe('omit');
    context.set({});
    TestBed.tick();
    await settle();
    expect(new URL(fetchMock.mock.calls.at(-1)?.[0] as string).search).toBe('');
  });

  it('cancela el sondeo y evita publicar respuestas después de destruir el inyector', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const flags = start();
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    TestBed.resetTestingModule();
    resolve(response({ toggles: [{ name: 'payments.qr', enabled: true }] }));
    await vi.advanceTimersByTimeAsync(200);
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(flags.listo()).toBe(false);
    expect(flags.isEnabledNow('payments.qr')).toBe(false);
  });

  it('sin proxy conserva defaults y no hace peticiones', async () => {
    TestBed.overrideProvider(FEATURE_FLAG_CONFIG, { useValue: { proxyUrl: '' } });
    const flags = start();
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
  });

  it('actualiza @if, directiva e inversión en un render Angular zoneless', async () => {
    const fixture = TestBed.createComponent(FlagHost);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).toContain('Sin hotel');
    fetchMock.mockResolvedValue(
      response({
        toggles: [
          { name: 'payments.qr', enabled: true },
          { name: 'vertical.hotel', enabled: true },
        ],
      }),
    );
    await vi.advanceTimersByTimeAsync(100);
    TestBed.tick();
    expect(host.querySelector('button')?.textContent).toBe('QR');
    expect(host.textContent).toContain('Hotel');
    expect(host.textContent).not.toContain('Sin hotel');
    fetchMock.mockResolvedValue(response({ toggles: [] }));
    await vi.advanceTimersByTimeAsync(100);
    TestBed.tick();
    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).toContain('Sin hotel');
  });
});
