package com.mapit.reservations.application.reservation;

import java.util.UUID;

/** El elemento existe, pero no puede formar parte de la reserva solicitada. */
public final class InvalidReservationResourceException extends RuntimeException {

  private InvalidReservationResourceException(String message) {
    super(message);
  }

  public static InvalidReservationResourceException differentEstablishment(
      UUID elementId, UUID establishmentId) {
    return new InvalidReservationResourceException(
        "El elemento " + elementId + " no pertenece al establecimiento " + establishmentId);
  }

  public static InvalidReservationResourceException notReservable(UUID elementId) {
    return new InvalidReservationResourceException(
        "El elemento " + elementId + " no admite reservas");
  }

  public static InvalidReservationResourceException notActive(UUID elementId) {
    return new InvalidReservationResourceException(
        "El elemento " + elementId + " está fuera de servicio");
  }
}
