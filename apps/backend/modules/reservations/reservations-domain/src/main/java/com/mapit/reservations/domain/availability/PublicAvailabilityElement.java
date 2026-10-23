package com.mapit.reservations.domain.availability;

import java.util.Objects;
import java.util.UUID;

import com.mapit.reservations.domain.reservation.ReservationResource;

/** Proyección mínima de un elemento que puede mostrarse al cliente final. */
public record PublicAvailabilityElement(UUID id, ReservationResource.Kind type) {

  public PublicAvailabilityElement {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(type, "type no puede ser null");
    if (type == ReservationResource.Kind.DECOR) {
      throw new IllegalArgumentException("DECOR no puede aparecer en disponibilidad pública");
    }
  }
}
