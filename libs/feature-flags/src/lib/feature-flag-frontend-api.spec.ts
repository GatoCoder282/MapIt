import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { FeatureFlagService } from './feature-flag.service';
import { provideFeatureFlags } from './feature-flag.config';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ADR-0013: desplegado, el navegador consume la Frontend API de Unleash con el mismo contrato que
// unleash-proxy. Si este test se rompe, los entornos desplegados dejan de recibir flags.
it('consume la Frontend API de Unleash: URL tal cual, token crudo y toggles con campos extra', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        toggles: [
          {
            name: 'payments.qr',
            enabled: true,
            variant: { name: 'disabled', enabled: false, feature_enabled: true },
            impressionData: false,
          },
        ],
      }),
  });
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    providers: [
      provideFeatureFlags({
        proxyUrl: 'https://mapit-unleash.onrender.com/api/frontend',
        clientKey: 'default:development.0123abcd',
        intervaloRefrescoMs: 60_000,
      }),
    ],
  });
  const flags = TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(0);

  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapit-unleash.onrender.com/api/frontend',
    expect.objectContaining({
      headers: { Authorization: 'default:development.0123abcd' },
      credentials: 'omit',
      cache: 'no-store',
    }),
  );
  expect(flags.listo()).toBe(true);
  expect(flags.isEnabledNow('payments.qr')).toBe(true);
});
