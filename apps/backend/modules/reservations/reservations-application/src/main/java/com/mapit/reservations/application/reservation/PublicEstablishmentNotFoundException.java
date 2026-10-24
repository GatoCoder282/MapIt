package com.mapit.reservations.application.reservation;

/** El tenant o establecimiento público no existe o no está disponible. */
public final class PublicEstablishmentNotFoundException extends RuntimeException {

  public PublicEstablishmentNotFoundException() {
    super("El tenant o el establecimiento no están disponibles.");
  }
}
