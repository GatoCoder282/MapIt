package com.mapit.identity.domain;

/** Error del puerto de intentos, sin datos de cuenta, origen ni credenciales. */
public final class OwnPasswordRateLimited extends RuntimeException {
  private final int retryAfterSeconds;

  public OwnPasswordRateLimited(int retryAfterSeconds) {
    super("Demasiados intentos de cambio de contraseña.");
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public int retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
