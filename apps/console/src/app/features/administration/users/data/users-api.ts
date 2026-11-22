import { Injectable, inject } from '@angular/core';
import {
  UsersService,
  type TenantUserDeactivationRequest,
  type TenantUserInvitationRequest,
  type TenantUserRoleChangeRequest,
} from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly client = inject(UsersService);

  list(page: number, size: number) {
    return this.client.listTenantUsers({ page, size });
  }

  listInvitations(page: number, size: number) {
    return this.client.listTenantUserInvitations({ page, size });
  }

  detail(userId: string) {
    return this.client.getTenantUser({ userId });
  }

  invite(request: TenantUserInvitationRequest) {
    return this.client.inviteTenantUser({ tenantUserInvitationRequest: request });
  }

  changeRole(userId: string, request: TenantUserRoleChangeRequest) {
    return this.client.changeTenantUserRole({ userId, tenantUserRoleChangeRequest: request });
  }

  deactivate(userId: string) {
    const request: TenantUserDeactivationRequest = { active: false };
    return this.client.deactivateTenantUser({ userId, tenantUserDeactivationRequest: request });
  }

  resend(invitationId: string) {
    return this.client.resendTenantUserInvitation({ invitationId });
  }
}
