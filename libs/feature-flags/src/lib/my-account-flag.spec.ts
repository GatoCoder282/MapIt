import { TestBed } from '@angular/core/testing';
import { Logger } from '@mapit/logging';
import { afterEach, expect, it, vi } from 'vitest';
import { provideFeatureFlags } from './feature-flag.config';
import { FeatureFlagService } from './feature-flag.service';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('no consulta el proxy y mantiene Mi cuenta OFF sin URL configurada', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    providers: [provideFeatureFlags({ proxyUrl: '' })],
  });
  const flags = TestBed.inject(FeatureFlagService);
  expect(flags.isEnabled('mapit.s6.my-account')()).toBe(false);
  expect(flags.isEnabledNow('mapit.s6.my-account')).toBe(false);
  expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('conserva Mi cuenta OFF si falla la primera evaluación', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('proxy unavailable')));
  TestBed.configureTestingModule({
    providers: [
      provideFeatureFlags({ intervaloRefrescoMs: 100 }),
      { provide: Logger, useValue: { log: vi.fn() } },
    ],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(100);
  expect(flags.listo()).toBe(false);
  expect(flags.isEnabledNow('mapit.s6.my-account')).toBe(false);
});

it('mantiene Mi cuenta OFF si el proxy responde sin esa clave', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ toggles: [{ name: 'realtime.websocket', enabled: true }] }),
    }),
  );
  TestBed.configureTestingModule({
    providers: [provideFeatureFlags({ intervaloRefrescoMs: 100 })],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(100);
  expect(flags.listo()).toBe(true);
  expect(flags.isEnabled('mapit.s6.my-account')()).toBe(false);
  expect(flags.isEnabledNow('realtime.websocket')).toBe(true);
});
