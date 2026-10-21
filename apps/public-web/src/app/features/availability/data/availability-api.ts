import { Injectable, inject } from '@angular/core';
import { PublicAvailabilityService } from '@mapit/api-client';
import type { PublicAvailability } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de consulta pública sobre el cliente generado de OpenAPI. */
@Injectable({ providedIn: 'root' })
export class AvailabilityApi {
  private readonly client = inject(PublicAvailabilityService);

  find(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
  ): Observable<PublicAvailability> {
    return this.client.findPublicAvailability({ tenantSlug, establishmentSlug, date });
  }
}
