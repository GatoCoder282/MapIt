import { Injectable, inject } from '@angular/core';
import { PublicAvailabilityService, type PublicEstablishmentSummary } from '@mapit/api-client';
import type { Observable } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly client = inject(PublicAvailabilityService);
  list(
    query: string,
    tenantSlug = '',
    limit = 20,
    offset = 0,
  ): Observable<PublicEstablishmentSummary[]> {
    return this.client.listPublicEstablishments({
      ...(query ? { query } : {}),
      ...(tenantSlug ? { tenantSlug } : {}),
      limit,
      offset,
    });
  }
}
