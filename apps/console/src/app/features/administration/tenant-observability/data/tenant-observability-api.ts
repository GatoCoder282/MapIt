import { Injectable, inject } from '@angular/core';
import { PlatformObservabilityService } from '@mapit/api-client';
import type {
  PlatformObservability,
  TenantHealthDetail,
  TenantHealthPage,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

export type WindowDays = 7 | 30;
export type TenantStatusFilter = 'ACTIVE' | 'SUSPENDED' | '';

@Injectable({ providedIn: 'root' })
export class TenantObservabilityApi {
  private readonly client = inject(PlatformObservabilityService);

  overview(days: WindowDays): Observable<PlatformObservability> {
    return this.client.getPlatformObservability({ days });
  }

  tenants(
    days: WindowDays,
    search: string,
    status: TenantStatusFilter,
    page: number,
  ): Observable<TenantHealthPage> {
    return this.client.listTenantHealth({
      days,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      page,
      size: 20,
    });
  }

  tenant(slug: string, days: WindowDays): Observable<TenantHealthDetail> {
    return this.client.getTenantHealth({ slug, days });
  }
}
