import { Injectable, inject } from '@angular/core';
import { PublicAvailabilityService } from '@mapit/api-client';
import type { VerticalProfile, PublicAvailability, PublicAvailabilityMap } from '@mapit/api-client';
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
    endDate = '',
  ): Observable<PublicAvailabilityMap> {
    return this.client.findPublicAvailabilityMap({
      tenantSlug,
      establishmentSlug,
      date,
      startTime,
      endTime,
      ...(endDate ? { endDate } : {}),
    });
  }

  /** HU-7.01/7.02: reglas y terminología del establecimiento antes de buscar. */
  profile(tenantSlug: string, establishmentSlug: string): Observable<VerticalProfile> {
    return this.client.getPublicVerticalProfile({ tenantSlug, establishmentSlug });
  }

  find(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
  ): Observable<PublicAvailability> {
    return this.client.findPublicAvailability({ tenantSlug, establishmentSlug, date });
  }
}
