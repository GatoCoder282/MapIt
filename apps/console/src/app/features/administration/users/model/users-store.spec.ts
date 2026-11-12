import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type {
  TenantUser,
  TenantUserInvitation,
  TenantUserInvitationPage,
  TenantUserPage,
} from '@mapit/api-client';
import { of, Subject, throwError } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { UsersApi } from '../data/users-api';
import { UsersStore } from './users-store';

const manager: TenantUser = {
  id: 'manager-id',
  fullName: 'Ana',
  email: 'ana@example.org',
  role: 'MANAGER',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const admin: TenantUser = { ...manager, id: 'admin-id', role: 'ADMIN' };
const invitation: TenantUserInvitation = {
  id: 'real-invitation-id',
  email: 'new@example.org',
  role: 'STAFF',
  status: 'PENDING',
  dispatchStatus: 'SMTP_FAILED',
  expiresAt: '2099-01-01T00:00:00Z',
};
const page: TenantUserPage = {
  content: [manager, admin],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};
const invitationPage: TenantUserInvitationPage = {
  content: [invitation],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('UsersStore', () => {
  const api = {
    list: vi.fn(() => of(page)),
    listInvitations: vi.fn(() => of(invitationPage)),
    detail: vi.fn(() => of(admin)),
    invite: vi.fn(() => of(invitation)),
    changeRole: vi.fn(() => of({ ...manager, role: 'STAFF' as const })),
    deactivate: vi.fn(() => of({ ...manager, active: false })),
    resend: vi.fn(() => of(invitation)),
  };
  let store: UsersStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(page));
    api.listInvitations.mockReturnValue(of(invitationPage));
    api.invite.mockReturnValue(of(invitation));
    api.changeRole.mockReturnValue(of({ ...manager, role: 'STAFF' }));
    TestBed.configureTestingModule({
      providers: [UsersStore, { provide: UsersApi, useValue: api }],
    });
    store = TestBed.inject(UsersStore);
  });

  it('carga páginas, detalle y expone estados de carga, vacío y error', () => {
    const response = new Subject<TenantUserPage>();
    api.list.mockReturnValueOnce(response.asObservable());
    store.load();
    expect(store.status()).toBe('loading');
    response.next(page);
    expect(store.status()).toBe('ready');
    expect(store.users()).toHaveLength(2);
    store.detail(admin);
    expect(api.detail).toHaveBeenCalledWith(admin.id);
    api.list.mockReturnValueOnce(of({ ...page, content: [] }));
    store.load();
    expect(store.users()).toEqual([]);
    api.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    store.load();
    expect(store.status()).toBe('error');
    expect(store.error()).toBe(STRINGS.users.errors.forbidden);
  });

  it('recupera después de recargar y reenvía con ID real incluso vencido', () => {
    store.loadInvitations(0);
    expect(api.listInvitations).toHaveBeenCalledWith(0, 20);
    expect(store.invitations()).toEqual([invitation]);
    store.invite(' new@example.org ', 'STAFF');
    expect(api.invite).toHaveBeenCalledWith({ email: 'new@example.org', role: 'STAFF' });
    expect(store.feedback()).toBe(STRINGS.users.invitation);
    store.resend(invitation);
    expect(api.resend).toHaveBeenCalledWith(invitation.id);
    expect(api.listInvitations).toHaveBeenCalledTimes(3);
    store.invitations.set([{ ...invitation, status: 'EXPIRED' }]);
    store.resend({ ...invitation, status: 'EXPIRED' });
    expect(api.resend).toHaveBeenCalledTimes(2);
  });

  it('respeta cooldown, oculta las aceptadas y refresca sin perder el 409', () => {
    const cooling = {
      ...invitation,
      dispatchStatus: 'SMTP_ACCEPTED' as const,
      dispatchAttemptedAt: new Date().toISOString(),
    };
    api.listInvitations.mockReturnValueOnce(of({ ...invitationPage, content: [cooling] }));
    store.loadInvitations();
    expect(store.canResend(cooling)).toBe(false);
    store.resend(cooling);
    expect(api.resend).not.toHaveBeenCalled();
    const ready = { ...invitation, status: 'EXPIRED' as const };
    store.invitations.set([ready]);
    api.resend.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
    store.resend(ready);
    expect(store.invitationError()).toBe(STRINGS.users.errors.conflict);
    expect(api.listInvitations).toHaveBeenCalledTimes(2);
    store.invitations.set([]);
    store.resend(ready);
    expect(api.resend).toHaveBeenCalledTimes(1);
  });

  it('limita mutaciones a cuentas M/S activas, usa expectedRole y refresca', () => {
    store.ask(admin, 'deactivate');
    expect(store.pending()).toBeNull();
    store.ask(manager, 'role');
    store.confirm();
    expect(api.changeRole).toHaveBeenCalledWith(manager.id, {
      role: 'STAFF',
      expectedRole: 'MANAGER',
    });
    expect(api.list).toHaveBeenCalledTimes(1);
    store.ask(manager, 'deactivate');
    expect(api.deactivate).not.toHaveBeenCalled();
    store.confirm();
    expect(api.deactivate).toHaveBeenCalledWith(manager.id);
    expect(store.canManage({ ...manager, active: false })).toBe(false);
  });

  it('ante 409 refresca el estado y explica el conflicto; 401 exige reingreso', () => {
    api.changeRole.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
    store.ask(manager, 'role');
    store.confirm();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.error()).toBe(STRINGS.users.errors.conflict);
    api.invite.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    store.invite('new@example.org', 'MANAGER');
    expect(store.error()).toBe(STRINGS.users.errors.unauthorized);
  });
});
