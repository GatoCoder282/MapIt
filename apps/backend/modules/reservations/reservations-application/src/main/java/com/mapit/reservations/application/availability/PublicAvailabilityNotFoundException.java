package com.mapit.reservations.application.availability;

/** El tenant o el establecimiento no son visibles para una consulta pública. */
public class PublicAvailabilityNotFoundException extends RuntimeException {

  public PublicAvailabilityNotFoundException() {
    super("El tenant o el establecimiento no están disponibles.");
  }
}
