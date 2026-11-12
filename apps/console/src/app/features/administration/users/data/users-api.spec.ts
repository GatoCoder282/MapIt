import { TestBed } from '@angular/core/testing';
import { UsersService } from '@mapit/api-client';
import { of } from 'rxjs';

import { UsersApi } from './users-api';

describe('UsersApi (cliente generado)', () => {
  const client = {
    listTenantUsers: vi.fn(() => of(null)),
    listTenantUserInvitations: vi.fn(() => of(null)),
    getTenantUser: vi.fn(() => of(null)),
    inviteTenantUser: vi.fn(() => of(null)),
    changeTenantUserRole: vi.fn(() => of(null)),
    deactivateTenantUser: vi.fn(() => of(null)),
    resendTenantUserInvitation: vi.fn(() => of(null)),
  };

  it('usa las operaciones y DTO reales sin tenant ni contraseña ni reactivación', () => {
    TestBed.configureTestingModule({ providers: [{ provide: UsersService, useValue: client }] });
    const api = TestBed.inject(UsersApi);
    api.list(1, 20).subscribe();
    api.listInvitations(0, 20).subscribe();
    api.detail('user-id').subscribe();
    api.invite({ email: 'new@example.org', role: 'MANAGER' }).subscribe();
    api.changeRole('user-id', { role: 'STAFF', expectedRole: 'MANAGER' }).subscribe();
    api.deactivate('user-id').subscribe();
    api.resend('invitation-id').subscribe();
    expect(client.listTenantUsers).toHaveBeenCalledWith({ page: 1, size: 20 });
    expect(client.listTenantUserInvitations).toHaveBeenCalledWith({ page: 0, size: 20 });
    expect(client.getTenantUser).toHaveBeenCalledWith({ userId: 'user-id' });
    expect(client.inviteTenantUser).toHaveBeenCalledWith({
      tenantUserInvitationRequest: { email: 'new@example.org', role: 'MANAGER' },
    });
    expect(client.changeTenantUserRole).toHaveBeenCalledWith({
      userId: 'user-id',
      tenantUserRoleChangeRequest: { role: 'STAFF', expectedRole: 'MANAGER' },
    });
    expect(client.deactivateTenantUser).toHaveBeenCalledWith({
      userId: 'user-id',
      tenantUserDeactivationRequest: { active: false },
    });
    expect(client.resendTenantUserInvitation).toHaveBeenCalledWith({
      invitationId: 'invitation-id',
    });
  });
});
