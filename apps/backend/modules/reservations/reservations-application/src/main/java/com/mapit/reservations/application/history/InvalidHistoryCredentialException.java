package com.mapit.reservations.application.history;

public class InvalidHistoryCredentialException extends RuntimeException {
  public InvalidHistoryCredentialException() {
    super("Credencial de historial no válida");
  }
}
