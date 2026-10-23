import { Injectable, inject } from '@angular/core';
import { TenantsService } from '@mapit/api-client';
import type {
  Tenant,
  TenantPage,
  TenantRequest,
  TenantStatus,
  TenantUpdateRequest,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de datos de la administración de tenants; las pantallas solo conocen la API tipada del contrato. */
@Injectable({ providedIn: 'root' })
export class TenantsApi {
  private readonly client = inject(TenantsService);

  list(params: {
    search?: string;
    status?: TenantStatus;
    page?: number;
    size?: number;
  }): Observable<TenantPage> {
    return this.client.listTenants(params);
  }

  getById(tenantId: string): Observable<Tenant> {
    return this.client.getTenant({ tenantId });
  }

  create(request: TenantRequest): Observable<Tenant> {
    return this.client.createTenant({ tenantRequest: request });
  }

  update(tenantId: string, request: TenantUpdateRequest): Observable<Tenant> {
    return this.client.updateTenant({ tenantId, tenantUpdateRequest: request });
  }

  changeStatus(tenantId: string, status: TenantStatus): Observable<Tenant> {
    return this.client.updateTenant({ tenantId, tenantUpdateRequest: { status } });
  }
}
