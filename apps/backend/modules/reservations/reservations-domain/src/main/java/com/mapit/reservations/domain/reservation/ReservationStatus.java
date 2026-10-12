package com.mapit.reservations.domain.reservation;

import java.util.List;

/** Estados y destinos permitidos del ciclo de vida de CU-13. */
public enum ReservationStatus {
  CREATED,
  CONFIRMED,
  ACTIVE,
  RELEASED,
  CANCELLED;

  /** Destinos válidos según el único catálogo de transiciones de reservas. */
  public List<ReservationStatus> allowedTransitions() {
    return switch (this) {
      case CREATED -> List.of(CONFIRMED, CANCELLED);
      case CONFIRMED -> List.of(ACTIVE, CANCELLED);
      case ACTIVE -> List.of(RELEASED, CANCELLED);
      case RELEASED, CANCELLED -> List.of();
    };
  }

  public boolean canTransitionTo(ReservationStatus target) {
    return allowedTransitions().contains(target);
  }
}
