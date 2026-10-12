package com.mapit.reservations.application.reservation;

/** La reserva cambió después de ser leída por otra operación concurrente. */
public final class ReservationStatusUpdateConflictException extends RuntimeException {

  public ReservationStatusUpdateConflictException() {
    super("La reserva cambió mientras se solicitaba la transición");
  }
}
