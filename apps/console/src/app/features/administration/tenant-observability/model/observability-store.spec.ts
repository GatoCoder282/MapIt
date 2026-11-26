import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PlatformObservability, TenantHealthPage } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { TenantObservabilityApi } from '../data/tenant-observability-api';
import { ObservabilityStore } from './observability-store';
import { TenantHealthStore } from './tenant-health-store';

const OVERVIEW = { windowDays: 7 } as PlatformObservability;
const PAGE: TenantHealthPage = { content: [], page: 0, size: 20, totalElements: 0 };

describe('Observabilidad de plataforma (HU-7.08)', () => {
  const api = {
    overview: vi.fn(() => of(OVERVIEW)),
    tenants: vi.fn(() => of(PAGE)),
    tenant: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.overview.mockReturnValue(of(OVERVIEW));
    api.tenants.mockReturnValue(of(PAGE));
    TestBed.configureTestingModule({
      providers: [
        ObservabilityStore,
        TenantHealthStore,
        { provide: TenantObservabilityApi, useValue: api },
      ],
    });
  });

  const failure = (status: number, type?: string) =>
    throwError(() => new HttpErrorResponse({ status, error: type ? { type } : null }));

  it('aplica ventana y filtros volviendo a la primera página', () => {
    const store = TestBed.inject(ObservabilityStore);
    store.changePage(2);
    store.apply('  casa  ', 'ACTIVE');
    store.setDays(30);

    expect(api.tenants).toHaveBeenLastCalledWith(30, 'casa', 'ACTIVE', 0);
    expect(store.status()).toBe('loaded');
  });

  it('distingue sección apagada de fallo técnico y no conserva cifras viejas', () => {
    const store = TestBed.inject(ObservabilityStore);
    store.load();

    api.overview.mockReturnValue(failure(500));
    store.load();
    expect(store.status()).toBe('error');
    expect(store.overview()).toBeNull();

    api.overview.mockReturnValue(failure(404, 'x/tenant-observability-disabled'));
    store.load();
    expect(store.status()).toBe('disabled');
  });

  it('en el detalle distingue empresa inexistente', () => {
    api.tenant.mockReturnValue(failure(404, 'https://mapit.local/problems/tenant-not-found'));
    const store = TestBed.inject(TenantHealthStore);

    store.open('no-existe');

    expect(api.tenant).toHaveBeenCalledWith('no-existe', 7);
    expect(store.status()).toBe('missing');
  });
});
