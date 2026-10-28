import { Injectable, inject } from '@angular/core';
import {
  PublicReservationsService,
  PublicAvailabilityService,
  PublicPaymentsService,
} from '@mapit/api-client';
import type {
  PublicAvailabilityMap,
  PublicCheckout,
  PublicReservation,
  PublicReservationCreateRequest,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';
import { ReservationAccess, type ReservationAccessScope } from '../../../core/reservation-access';

/** Adaptador de creación pública de reservas sobre el cliente generado de OpenAPI. */
@Injectable({ providedIn: 'root' })
export class BookingApi {
  private readonly client = inject(PublicReservationsService);
  private readonly availability = inject(PublicAvailabilityService);
  private readonly payments = inject(PublicPaymentsService);
  private readonly access = inject(ReservationAccess);

  map(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Observable<PublicAvailabilityMap> {
    return this.availability.findPublicAvailabilityMap({
      tenantSlug,
      establishmentSlug,
      date,
      startTime,
      endTime,
    });
  }
  checkout(scope: ReservationAccessScope): Observable<PublicCheckout> {
    const token = this.access.read(scope);
    if (!token) throw new Error('reservation-access-required');
    return this.payments.getPublicCheckout({ ...scope, xReservationAccess: token });
  }

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
