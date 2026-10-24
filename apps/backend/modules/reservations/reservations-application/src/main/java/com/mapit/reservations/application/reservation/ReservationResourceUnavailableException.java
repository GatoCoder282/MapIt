package com.mapit.reservations.application.reservation;

import java.util.Set;
import java.util.UUID;

/** Uno o más elementos existen pero ya no están operativamente disponibles. */
public final class ReservationResourceUnavailableException extends RuntimeException {

  private final Set<UUID> unavailableElementIds;

  public ReservationResourceUnavailableException(Set<UUID> unavailableElementIds) {
    super("Los elementos seleccionados ya no están disponibles");
    if (unavailableElementIds.isEmpty()) {
      throw new IllegalArgumentException("Debe existir al menos un elemento no disponible");
    }
    this.unavailableElementIds = Set.copyOf(unavailableElementIds);
  }

  public Set<UUID> unavailableElementIds() {
    return unavailableElementIds;
  }
}
