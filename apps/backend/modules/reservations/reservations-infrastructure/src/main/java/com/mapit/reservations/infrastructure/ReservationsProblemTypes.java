package com.mapit.reservations.infrastructure;

/** Tipos RFC 9457 de los errores de la API del contexto reservations. */
public final class ReservationsProblemTypes {

  public static final String BASE = "https://mapit.local/problems/";
  public static final String REFERENCE_NOT_FOUND = BASE + "reservation-reference-not-found";
  public static final String INVALID_RESERVATION = BASE + "invalid-reservation";
  public static final String RESERVATION_OVERLAP = BASE + "reservation-overlap";

  private ReservationsProblemTypes() {}
}
