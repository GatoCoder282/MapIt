import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { FeatureFlagService } from './feature-flag.service';
import { provideFeatureFlags } from './feature-flag.config';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('registra degradación una vez y recuperación sin filtrar claves ni perder flags', async () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const fetchMock = vi.fn().mockRejectedValue(new Error('private-canary'));
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    providers: [provideFeatureFlags({ clientKey: 'private-canary', intervaloRefrescoMs: 100 })],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(250);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(flags.listo()).toBe(false);
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ toggles: [{ name: 'realtime.websocket', enabled: true }] }),
  });
  await vi.advanceTimersByTimeAsync(100);
  expect(flags.listo()).toBe(true);
  expect(info).toHaveBeenCalledTimes(1);
  expect(JSON.stringify([...warn.mock.calls, ...info.mock.calls])).not.toContain('private-canary');
});

it('apaga las solicitudes públicas si el proxy cae después de estar encendidas', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const online = {
    ok: true,
    json: () =>
      Promise.resolve({ toggles: [{ name: 'mapit.s6.business-applications', enabled: true }] }),
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(online)
    .mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    providers: [provideFeatureFlags({ clientKey: 'test-key', intervaloRefrescoMs: 100 })],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(1);
  expect(flags.isEnabledNow('mapit.s6.business-applications')).toBe(true);
  await vi.advanceTimersByTimeAsync(100);
  expect(flags.isEnabledNow('mapit.s6.business-applications')).toBe(false);
  fetchMock.mockResolvedValue(online);
  await vi.advanceTimersByTimeAsync(100);
  expect(flags.isEnabledNow('mapit.s6.business-applications')).toBe(true);
});
