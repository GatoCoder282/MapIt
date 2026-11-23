import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment, TenantUser } from '@mapit/api-client';
import { AuthSession, type SessionUser } from '@mapit/auth';
import { of, Subject, throwError } from 'rxjs';

import { StaffAccessApi } from '../data/staff-access-api';
import { StaffEstablishments } from './staff-establishments';

const staff: TenantUser = {
  id: 'staff-a',
  fullName: 'Operador',
  email: 'operator@example.test',
  role: 'STAFF',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const venue: AccessibleEstablishment = {
  id: 'venue-a',
  name: 'Local A1',
  slug: 'a1',
  address: null,
  timezone: 'America/La_Paz',
  canManagePayments: true,
  canCheckIn: true,
};
const administrator: SessionUser = {
  id: 'admin-a',
  tenantId: 'tenant-a',
  email: 'admin@example.test',
  fullName: 'Administrador',
  role: 'ADMIN',
};

describe('StaffEstablishments', () => {
  const api = {
    establishments: vi.fn(() => of([venue])),
    staff: vi.fn(() =>
      of([{ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: false }]),
    ),
    save: vi.fn(() =>
      of({ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: true }),
    ),
  };
  let session: ReturnType<typeof signal<SessionUser | null>>;

  beforeEach(() => {
    vi.clearAllMocks();
    session = signal<SessionUser | null>(administrator);
    api.establishments.mockReturnValue(of([venue]));
    api.staff.mockReturnValue(
      of([{ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: false }]),
    );
    api.save.mockReturnValue(
      of({ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: true }),
    );
    TestBed.configureTestingModule({
      imports: [StaffEstablishments],
      providers: [
        { provide: StaffAccessApi, useValue: api },
        { provide: AuthSession, useValue: { user: session.asReadonly() } },
      ],
    });
  });

  it('permite conceder acceso desde la lista y confirma el estado recargado', async () => {
    const fixture = TestBed.createComponent(StaffEstablishments);
    fixture.componentRef.setInput('user', staff);
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Local A1');
    expect(host.textContent).toContain('Sin asignar');
    const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    checkbox.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Hay cambios sin guardar');
    expect(host.textContent).toContain('Por asignar');
    api.staff.mockReturnValue(
      of([{ userId: staff.id, fullName: staff.fullName, email: staff.email, canCheckIn: true }]),
    );
    host.querySelector<HTMLButtonElement>('.actions button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.save).toHaveBeenCalledWith(venue.id, staff.id, true);
    expect(host.textContent).toContain('Asignaciones guardadas y verificadas');
    expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBe(true);
  });

  it('muestra carga, vacío y error sin afirmar que una concesión se guardó', async () => {
    const pending = new Subject<AccessibleEstablishment[]>();
    api.establishments.mockReturnValueOnce(pending.asObservable());
    const fixture = TestBed.createComponent(StaffEstablishments);
    fixture.componentRef.setInput('user', staff);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Cargando establecimientos');
    pending.next([]);
    pending.complete();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('todavía no tiene establecimientos');
    });

    api.establishments.mockReturnValueOnce(throwError(() => new Error('network')));
    fixture.componentRef.setInput('user', { ...staff });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('[role=alert]')?.textContent).toContain('No se pudieron cargar');
    });
    expect(host.textContent).not.toContain('guardadas y verificadas');
  });

  it('no ofrece controles ni solicita datos para MANAGER o STAFF', async () => {
    session.set({ ...administrator, role: 'MANAGER' });
    const fixture = TestBed.createComponent(StaffEstablishments);
    fixture.componentRef.setInput('user', staff);
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect(api.establishments).not.toHaveBeenCalled();
  });
});
