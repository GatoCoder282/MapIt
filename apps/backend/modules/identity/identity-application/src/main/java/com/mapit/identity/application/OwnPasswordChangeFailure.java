package com.mapit.identity.application;

/** Razones seguras para un futuro adaptador Problem; no conserva entradas ni causas sensibles. */
public final class OwnPasswordChangeFailure extends RuntimeException {
  public enum Reason {
    INVALID_REQUEST, INVALID_CURRENT_PASSWORD, INVALID_NEW_PASSWORD, CONFIRMATION_MISMATCH, PASSWORD_REUSED
  }

  private final Reason reason;

  public OwnPasswordChangeFailure(Reason reason) {
    super("Solicitud de cambio de contraseña no válida.");
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
