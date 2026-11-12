import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { TenantUser, TenantUserInvitation, TenantUserPage } from '@mapit/api-client';
import { I18nService } from '@mapit/i18n';
import { of } from 'rxjs';

import { UsersApi } from '../data/users-api';
import { Users } from './users';

const member: TenantUser = {
  id: 'member',
  fullName: 'Ana',
  email: 'ana@example.org',
  role: 'MANAGER',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const administrator: TenantUser = { ...member, id: 'admin', fullName: 'Luis', role: 'ADMIN' };
const page: TenantUserPage = {
  content: [member, administrator],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};
const invitation: TenantUserInvitation = {
  id: 'invitation-id',
  email: 'new@example.org',
  role: 'STAFF',
  status: 'PENDING',
  dispatchStatus: 'SMTP_ACCEPTED',
  expiresAt: '2099-01-01T00:00:00Z',
};

describe('Users (ADMIN)', () => {
  const api = {
    list: vi.fn(() => of(page)),
    listInvitations: vi.fn(() =>
      of({ content: [invitation], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
    ),
    detail: vi.fn(() => of(member)),
    invite: vi.fn(() => of(invitation)),
    changeRole: vi.fn(() => of(member)),
    deactivate: vi.fn(() => of({ ...member, active: false })),
    resend: vi.fn(() => of(invitation)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(page));
    TestBed.configureTestingModule({
      providers: [
        { provide: UsersApi, useValue: api },
        { provide: I18nService, useValue: { locale: signal('es-ES') } },
      ],
    });
  });

  it('muestra las cuentas y oculta mutaciones sobre ADMIN, inactivos y reactivación', async () => {
    const fixture = TestBed.createComponent(Users);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('tbody')[1]?.querySelectorAll('tr') ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Ana');
    expect(rows[1]?.querySelectorAll('button')).toHaveLength(1);
    expect(element.textContent).not.toContain('Reactivar');
    expect(element.querySelector('input[type=password]')).toBeNull();
    const roles = element.querySelectorAll<HTMLOptionElement>('#invite-role option');
    expect(Array.from(roles, (option) => option.value)).toEqual(['MANAGER', 'STAFF']);
  });

  it('envía invitación con correo y rol, informa estado SMTP sin prometer entrega', async () => {
    const fixture = TestBed.createComponent(Users);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#invite-email') as HTMLInputElement;
    input.value = 'new@example.org';
    input.dispatchEvent(new Event('input'));
    const form = element.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(api.invite).toHaveBeenCalledWith({ email: 'new@example.org', role: 'STAFF' });
    expect(element.textContent).toContain('SMTP');
    expect(element.textContent).toContain('no se confirma entrega');
    const resend = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reenviar'),
    );
    resend?.click();
    expect(api.resend).toHaveBeenCalledWith('invitation-id');
  });

  it('recupera invitaciones de una sesión nueva y muestra el vencimiento y el cooldown', async () => {
    api.listInvitations.mockReturnValueOnce(
      of({
        content: [
          { ...invitation, status: 'EXPIRED' as const, dispatchStatus: 'SMTP_FAILED' as const },
          { ...invitation, id: 'unknown-id', dispatchStatus: 'UNKNOWN' as const },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      }),
    );
    const fixture = TestBed.createComponent(Users);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(api.listInvitations).toHaveBeenCalledWith(0, 20);
    expect(element.textContent).toContain('Vencida');
    expect(element.textContent).toContain('new@example.org');
    expect(element.textContent).toContain('El envío SMTP falló');
    expect(element.textContent).toContain('no está confirmado');
    expect(element.textContent).not.toContain('entregado al destinatario');
  });

  it('requiere confirmación antes de desactivar y solo usa active:false', async () => {
    const fixture = TestBed.createComponent(Users);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const row = element.querySelectorAll('tbody')[1]?.querySelector('tr') as HTMLTableRowElement;
    const deactivate = Array.from(row.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Desactivar'),
    );
    deactivate?.click();
    expect(api.deactivate).not.toHaveBeenCalled();
    const confirm = Array.from(dialog.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirmar'),
    );
    confirm?.click();
    expect(api.deactivate).toHaveBeenCalledWith('member');
  });
});
