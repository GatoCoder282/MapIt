package com.mapit.reservations.domain.reservation;

import java.util.Objects;

/** La reserva no admite el destino solicitado desde su estado actual. */
public final class ReservationTransitionNotAllowedException extends RuntimeException {

  private final ReservationStatus currentStatus;
  private final ReservationStatus requestedStatus;

  public ReservationTransitionNotAllowedException(
      ReservationStatus currentStatus, ReservationStatus requestedStatus) {
    super("Transición no permitida: " + currentStatus + " -> " + requestedStatus);
    this.currentStatus = Objects.requireNonNull(currentStatus, "currentStatus no puede ser null");
    this.requestedStatus =
        Objects.requireNonNull(requestedStatus, "requestedStatus no puede ser null");
  }

  public ReservationStatus currentStatus() {
    return currentStatus;
  }

  public ReservationStatus requestedStatus() {
    return requestedStatus;
  }
}
