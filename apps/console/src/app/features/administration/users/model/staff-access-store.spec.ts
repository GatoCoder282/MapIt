import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment, TenantUser } from '@mapit/api-client';
import { AuthSession, type SessionUser } from '@mapit/auth';
import { of, throwError } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { StaffAccessApi } from '../data/staff-access-api';
import { StaffAccessStore } from './staff-access-store';

const staff: TenantUser = {
  id: 'staff-a',
  fullName: 'Operador A',
  email: 'operator@example.test',
  role: 'STAFF',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const venueA: AccessibleEstablishment = {
  id: 'venue-a',
  name: 'Local A1',
  slug: 'a1',
  address: null,
  timezone: 'America/La_Paz',
  canManagePayments: true,
  canCheckIn: true,
};
const venueA2 = { ...venueA, id: 'venue-a2', name: 'Local A2', slug: 'a2' };
const adminSession: SessionUser = {
  id: 'admin-a',
  tenantId: 'tenant-a',
  email: 'admin@example.test',
  fullName: 'Administrador A',
  role: 'ADMIN',
};

describe('StaffAccessStore', () => {
  let store: StaffAccessStore;
  let currentUser: ReturnType<typeof signal<SessionUser | null>>;
  let grants: Map<string, boolean>;
  const api = {
    establishments: vi.fn(() => of([venueA, venueA2])),
    staff: vi.fn((id: string) =>
      of([
        {
          userId: staff.id,
          fullName: staff.fullName,
          email: staff.email,
          canCheckIn: grants.get(id) ?? false,
        },
      ]),
    ),
    save: vi.fn((id: string, _userId: string, value: boolean) => {
      grants.set(id, value);
      return of({
        userId: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        canCheckIn: value,
      });
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    grants = new Map([['venue-a', true]]);
    currentUser = signal<SessionUser | null>(adminSession);
    api.establishments.mockReturnValue(of([venueA, venueA2]));
    api.staff.mockImplementation((id) =>
      of([
        {
          userId: staff.id,
          fullName: staff.fullName,
          email: staff.email,
          canCheckIn: grants.get(id) ?? false,
        },
      ]),
    );
    api.save.mockImplementation((id, _userId, value) => {
      grants.set(id, value);
      return of({
        userId: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        canCheckIn: value,
      });
    });
    TestBed.configureTestingModule({
      providers: [
        StaffAccessStore,
        { provide: StaffAccessApi, useValue: api },
        { provide: AuthSession, useValue: { user: currentUser.asReadonly() } },
      ],
    });
    store = TestBed.inject(StaffAccessStore);
  });

  it('muestra las concesiones vigentes y guarda altas y revocaciones verificadas', async () => {
    await store.load(staff);
    expect(store.assignments().map(({ granted }) => granted)).toEqual([true, false]);
    store.toggle('venue-a');
    store.toggle('venue-a2');
    expect(store.canSave()).toBe(true);
    await store.save(staff);

    expect(api.save).toHaveBeenCalledWith('venue-a', staff.id, false);
    expect(api.save).toHaveBeenCalledWith('venue-a2', staff.id, true);
    expect(store.assignments().map(({ granted }) => granted)).toEqual([false, true]);
    expect(store.feedback()).toBe(STRINGS.users.staffAccess.saved);
    expect(store.canSave()).toBe(false);
    await store.load(staff);
    expect(store.assignments().map(({ granted }) => granted)).toEqual([false, true]);
  });

  it('expone el estado real y un error cuando solo una operación se guarda', async () => {
    await store.load(staff);
    store.toggle('venue-a');
    store.toggle('venue-a2');
    api.save.mockImplementationOnce(() => throwError(() => new Error('network')));
    await store.save(staff);

    expect(store.assignments().map(({ granted }) => granted)).toEqual([true, true]);
    expect(store.feedback()).toBe('');
    expect(store.error()).toBe(STRINGS.users.staffAccess.partialError);
  });

  it('no anuncia éxito si falla el guardado o la verificación posterior', async () => {
    await store.load(staff);
    store.toggle('venue-a');
    api.save.mockImplementationOnce(() => throwError(() => new Error('network')));
    await store.save(staff);
    expect(store.error()).toBe(STRINGS.users.staffAccess.saveError);
    expect(store.feedback()).toBe('');

    store.toggle('venue-a');
    api.staff.mockImplementationOnce(() => throwError(() => new Error('network')));
    await store.save(staff);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe(STRINGS.users.staffAccess.verifyError);
    expect(store.feedback()).toBe('');
  });

  it('no anuncia éxito si el servidor responde 200 pero la recarga no refleja el cambio', async () => {
    await store.load(staff);
    store.toggle('venue-a');
    api.save.mockImplementationOnce((_id, _userId, value) =>
      of({ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: value }),
    );
    await store.save(staff);
    expect(store.assignments()[0]?.granted).toBe(true);
    expect(store.feedback()).toBe('');
    expect(store.error()).toBe(STRINGS.users.staffAccess.partialError);
  });

  it('bloquea mutaciones de usuarios no STAFF, inactivos y sesiones no ADMIN', async () => {
    const manager = { ...staff, role: 'MANAGER' as const };
    await store.load(manager);
    expect(store.status()).toBe('idle');
    expect(api.establishments).not.toHaveBeenCalled();
    await store.load({ ...staff, active: false });
    expect(api.establishments).not.toHaveBeenCalled();
    currentUser.set({ ...adminSession, role: 'MANAGER' });
    await store.load(staff);
    expect(api.establishments).not.toHaveBeenCalled();
    currentUser.set({ ...adminSession, role: 'STAFF' });
    await store.load(staff);
    expect(api.establishments).not.toHaveBeenCalled();
    store.toggle('venue-a');
    await store.save(staff);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('distingue tenant sin establecimientos de fallo de lectura', async () => {
    api.establishments.mockReturnValueOnce(of([]));
    await store.load(staff);
    expect(store.status()).toBe('ready');
    expect(store.assignments()).toEqual([]);
    api.staff.mockImplementationOnce(() => throwError(() => new Error('network')));
    await store.load(staff);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe(STRINGS.users.staffAccess.loadError);
  });
});
