package com.mapit.reservations.domain.reservation;

/** Estados previstos por CU-13; HU-5.01 únicamente crea reservas en {@link #CREATED}. */
public enum ReservationStatus {
  CREATED,
  CONFIRMED,
  ACTIVE,
  RELEASED,
  CANCELLED
}
