package com.mapit.reservations.application.reservation;

import java.util.Set;
import java.util.UUID;

/** Uno o más elementos ya tienen una reserva vigente en parte del intervalo solicitado. */
public final class ReservationOverlapException extends RuntimeException {

  private final Set<UUID> conflictingElementIds;

  public ReservationOverlapException(Set<UUID> conflictingElementIds) {
    super("Existen elementos reservados durante el intervalo solicitado");
    if (conflictingElementIds.isEmpty()) {
      throw new IllegalArgumentException("Debe existir al menos un elemento en conflicto");
    }
    this.conflictingElementIds = Set.copyOf(conflictingElementIds);
  }

  public Set<UUID> conflictingElementIds() {
    return conflictingElementIds;
  }
}
