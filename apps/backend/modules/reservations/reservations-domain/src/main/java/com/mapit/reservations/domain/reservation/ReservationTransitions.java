package com.mapit.reservations.domain.reservation;

/** Máquina de transiciones de reserva compartida por pago y llegada. */
public final class ReservationTransitions {
  private ReservationTransitions() {}

  public static boolean allows(ReservationStatus previous, ReservationStatus next) {
    if (previous == next) return true;
    return switch (previous) {
      case CREATED -> next == ReservationStatus.CONFIRMED || next == ReservationStatus.CANCELLED;
      case CONFIRMED -> next == ReservationStatus.ACTIVE || next == ReservationStatus.CANCELLED;
      case ACTIVE -> next == ReservationStatus.RELEASED;
      case RELEASED, CANCELLED -> false;
    };
  }

  public static void requireAllowed(ReservationStatus previous, ReservationStatus next) {
    if (!allows(previous, next)) throw new IllegalArgumentException("Transición de reserva inválida");
  }
}
