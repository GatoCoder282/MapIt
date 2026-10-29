import { Injectable, inject } from '@angular/core';
import { PublicAvailabilityService } from '@mapit/api-client';
import type { PublicAvailability, PublicAvailabilityMap } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de consulta pública sobre el cliente generado de OpenAPI. */
@Injectable({ providedIn: 'root' })
export class AvailabilityApi {
  private readonly client = inject(PublicAvailabilityService);

  map(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Observable<PublicAvailabilityMap> {
    return this.client.findPublicAvailabilityMap({
      tenantSlug,
      establishmentSlug,
      date,
      startTime,
      endTime,
    });
  }

  find(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
  ): Observable<PublicAvailability> {
    return this.client.findPublicAvailability({ tenantSlug, establishmentSlug, date });
  }
}
