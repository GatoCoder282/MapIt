import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Tenant, TenantPage } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { TenantsApi } from '../data/tenants-api';
import { TenantsListStore } from './tenants-list-store';

const TENANT: Tenant = {
  id: '2ad3e194-48d9-4c5d-b5e0-3c0b2c2b31ef',
  name: 'Empresa Norte',
  slug: 'empresa-norte',
  vertical: 'RESTAURANT',
  status: 'ACTIVE',
  createdAt: '2026-09-03T12:00:00Z',
  updatedAt: '2026-09-03T12:00:00Z',
};

function pageOf(content: Tenant[], totalPages = 1, total = content.length): TenantPage {
  return { content, page: 0, size: 20, totalElements: total, totalPages };
}

describe('TenantsListStore', () => {
  let store: TenantsListStore;
  const list = vi.fn((_: unknown) => of(pageOf([TENANT])));
  const api = { list } as unknown as TenantsApi;

  beforeEach(() => {
    list.mockClear();
    list.mockReturnValue(of(pageOf([TENANT])));
    TestBed.configureTestingModule({
      providers: [TenantsListStore, { provide: TenantsApi, useValue: api }],
    });
    store = TestBed.inject(TenantsListStore);
  });

  it('carga la primera página y la expone', () => {
    store.refresh();

    expect(store.status()).toBe('ready');
    expect(store.tenants()).toEqual([TENANT]);
    expect(store.isEmpty()).toBe(false);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 20 }));
  });

  it('expone el estado vacío cuando no hay resultados', () => {
    list.mockReturnValue(of(pageOf([])));

    store.refresh();

    expect(store.status()).toBe('ready');
    expect(store.isEmpty()).toBe(true);
  });

  it('expone el estado de error y permite reintentar', () => {
    list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Error' })),
    );

    store.refresh();

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toBe(STRINGS.tenants.error);

    store.retry();
    expect(store.status()).toBe('ready');
  });

  it('traduce el filtro de estado y vuelve a la primera página', () => {
    store.refresh({ page: 2 });
    store.onStatusFilter('SUSPENDED');

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, status: 'SUSPENDED' }),
    );
  });

  it('respeta los límites de paginación', () => {
    list.mockReturnValue(of(pageOf([TENANT], 3)));

    store.refresh();
    expect(store.canGoNext()).toBe(true);

    store.goNext();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });
});
