package com.mapit.reservations.application.reservation;

import java.util.UUID;

/** Una referencia no existe, está inactiva o pertenece a otro tenant. */
public final class ReservationReferenceNotFoundException extends RuntimeException {

  public ReservationReferenceNotFoundException(Reference reference, UUID id) {
    super(reference.label + " no encontrado: " + id);
  }

  public enum Reference {
    PERSON("Cliente"),
    ESTABLISHMENT("Establecimiento"),
    ELEMENT("Elemento espacial");

    private final String label;

    Reference(String label) {
      this.label = label;
    }
  }
}
