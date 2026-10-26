import { Injectable, inject } from '@angular/core';
import { PublicReservationsService } from '@mapit/api-client';
import type { PublicReservation, PublicReservationCreateRequest } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de creación pública de reservas sobre el cliente generado de OpenAPI. */
@Injectable({ providedIn: 'root' })
export class BookingApi {
  private readonly client = inject(PublicReservationsService);

  create(
    tenantSlug: string,
    establishmentSlug: string,
    request: PublicReservationCreateRequest,
  ): Observable<PublicReservation> {
    // OpenAPI genera `Set` para uniqueItems, pero JSON necesita un arreglo real.
    const serializableRequest: PublicReservationCreateRequest = {
      ...request,
      spaceElementIds: [...request.spaceElementIds] as unknown as Set<string>,
    };
    return this.client.createPublicReservation({
      tenantSlug,
      establishmentSlug,
      publicReservationCreateRequest: serializableRequest,
    });
  }
}
