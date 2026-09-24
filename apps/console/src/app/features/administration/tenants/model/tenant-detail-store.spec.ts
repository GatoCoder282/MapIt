import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Tenant } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { TenantsApi } from '../data/tenants-api';
import { TenantDetailStore } from './tenant-detail-store';

const TENANT: Tenant = {
  id: '2ad3e194-48d9-4c5d-b5e0-3c0b2c2b31ef',
  name: 'Empresa Norte',
  slug: 'empresa-norte',
  vertical: 'RESTAURANT',
  status: 'ACTIVE',
  createdAt: '2026-09-03T12:00:00Z',
  updatedAt: '2026-09-03T12:00:00Z',
};

describe('TenantDetailStore', () => {
  let store: TenantDetailStore;
  const getById = vi.fn(() => of(TENANT));
  const update = vi.fn(() => of(TENANT));
  const changeStatus = vi.fn(() => of<Tenant>({ ...TENANT, status: 'SUSPENDED' }));
  const api = { getById, update, changeStatus } as unknown as TenantsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockReturnValue(of(TENANT));
    update.mockReturnValue(of(TENANT));
    changeStatus.mockReturnValue(of({ ...TENANT, status: 'SUSPENDED' }));
    TestBed.configureTestingModule({
      providers: [TenantDetailStore, { provide: TenantsApi, useValue: api }],
    });
    store = TestBed.inject(TenantDetailStore);
  });

  it('carga el detalle por id', () => {
    store.load('t-1');

    expect(store.status()).toBe('ready');
    expect(store.tenant()).toEqual(TENANT);
  });

  it('expone not-found ante un 404', () => {
    getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    store.load('no-existe');

    expect(store.status()).toBe('not-found');
  });

  it('edita solo el nombre y notifica el éxito', () => {
    store.load('t-1');
    store.rename('  Nuevo nombre ');

    expect(update).toHaveBeenCalledWith(TENANT.id, { name: 'Nuevo nombre' });
    expect(store.feedback()?.kind).toBe('success');
  });

  it('suspende tras confirmar la transición', () => {
    store.load('t-1');

    store.askStatusChange();
    expect(store.confirming()).toBe('SUSPENDED');

    store.confirmStatusChange();

    expect(changeStatus).toHaveBeenCalledWith(TENANT.id, 'SUSPENDED');
    expect(store.tenant()?.status).toBe('SUSPENDED');
    expect(store.confirming()).toBeNull();
  });

  it('aprueba un tenant en aprobación tras confirmar', () => {
    getById.mockReturnValue(of({ ...TENANT, status: 'PENDING_APPROVAL' }));
    changeStatus.mockReturnValue(of(TENANT));
    store.load('t-1');

    store.askStatusChange();
    expect(store.confirming()).toBe('ACTIVE');
    expect(store.confirmKind()).toBe('approve');

    store.confirmStatusChange();

    expect(changeStatus).toHaveBeenCalledWith(TENANT.id, 'ACTIVE');
    expect(store.tenant()?.status).toBe('ACTIVE');
  });

  it('cancela la transición sin tocar la API', () => {
    store.load('t-1');

    store.askStatusChange();
    store.cancelStatusChange();

    expect(store.confirming()).toBeNull();
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('traduce un 403 de la API', () => {
    store.load('t-1');
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    store.rename('Otro');

    expect(store.feedback()?.message).toBe(STRINGS.tenantForm.errors.forbidden);
  });
});
