import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '@mapit/auth';

import { StaffShell } from './staff-shell';

describe('StaffShell navigation', () => {
  it('shows payment, check-in and audit links only for authorized roles', async () => {
    const user = signal({
      id: 'staff-1',
      tenantId: 'tenant-a',
      fullName: 'Test User',
      role: 'ADMIN',
    });
    await TestBed.configureTestingModule({
      imports: [StaffShell],
      providers: [provideRouter([]), { provide: AuthSession, useValue: { user } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(StaffShell);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const labels = () =>
      Array.from(host.querySelectorAll('nav a')).map((link) => link.textContent?.trim());

    expect(labels()).toEqual(
      expect.arrayContaining(['Métodos de pago', 'Recepción y check-in', 'Auditoría']),
    );

    user.set({ id: 'staff-1', tenantId: 'tenant-a', fullName: 'Test User', role: 'STAFF' });
    fixture.detectChanges();
    expect(labels()).toContain('Recepción y check-in');
    expect(labels()).not.toContain('Métodos de pago');
    expect(labels()).not.toContain('Auditoría');
  });
});
