import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Tenant } from '@mapit/api-client';
import { of, throwError } from 'rxjs';
import { TenantRegistrationApi } from '../data/tenant-registration-api';
import { TenantRegistrationStore } from './tenant-registration-store';

const TENANT: Tenant = {
  id: '2ad3e194-48d9-4c5d-b5e0-3c0b2c2b31ef',
  name: 'Empresa Norte',
  slug: 'empresa-norte',
  vertical: 'RESTAURANT',
  status: 'ACTIVE',
  createdAt: '2026-09-03T12:00:00Z',
  updatedAt: '2026-09-03T12:00:00Z',
};

describe('TenantRegistrationStore', () => {
  let store: TenantRegistrationStore;
  const create = vi.fn(() => of(TENANT));
  const api = { create } as unknown as TenantRegistrationApi;

  beforeEach(() => {
    create.mockReturnValue(of(TENANT));
    TestBed.configureTestingModule({
      providers: [TenantRegistrationStore, { provide: TenantRegistrationApi, useValue: api }],
    });
    store = TestBed.inject(TenantRegistrationStore);
  });

  it('normaliza el formulario y expone el tenant creado', () => {
    store.register({
      name: '  Empresa Norte ',
      slug: ' empresa-norte ',
      vertical: 'RESTAURANT',
      administratorEmail: ' admin@norte.bo ',
    });

    expect(create).toHaveBeenCalledWith({
      name: 'Empresa Norte',
      slug: 'empresa-norte',
      vertical: 'RESTAURANT',
      administratorEmail: 'admin@norte.bo',
    });
    expect(store.success()).toEqual(TENANT);
    expect(store.saving()).toBe(false);
  });

  it('traduce un conflicto de slug', () => {
    create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
    );

    store.register({
      name: 'Empresa Norte',
      slug: 'empresa-norte',
      vertical: 'HOTEL',
      administratorEmail: 'admin@norte.bo',
    });

    expect(store.error()).toBe('El slug ya está registrado.');
    expect(store.success()).toBeNull();
  });
});
