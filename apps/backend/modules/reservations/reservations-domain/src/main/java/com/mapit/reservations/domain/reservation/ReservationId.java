package com.mapit.reservations.domain.reservation;

import java.util.Objects;
import java.util.UUID;

/** Identificador opaco de una reserva. */
public record ReservationId(UUID value) {

  public ReservationId {
    Objects.requireNonNull(value, "reservationId no puede ser null");
  }

  public static ReservationId of(UUID value) {
    return new ReservationId(value);
  }

  public static ReservationId generate() {
    return new ReservationId(UUID.randomUUID());
  }

  @Override
  public String toString() {
    return value.toString();
  }
}
