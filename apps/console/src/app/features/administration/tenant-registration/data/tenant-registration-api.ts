import { Injectable, inject } from '@angular/core';
import { TenantsService } from '@mapit/api-client';
import type { Tenant, TenantRequest } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de datos del registro; la pantalla solo conoce la API tipada. */
@Injectable({ providedIn: 'root' })
export class TenantRegistrationApi {
  private readonly client = inject(TenantsService);

  create(request: TenantRequest): Observable<Tenant> {
    return this.client.createTenant({ tenantRequest: request });
  }
}
