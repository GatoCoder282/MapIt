package com.mapit.platform.application;

/** El presupuesto público se agotó; no revela si existe una solicitud. */
public final class BusinessApplicationRateLimited extends RuntimeException {
  private final int retryAfterSeconds;

  public BusinessApplicationRateLimited(int retryAfterSeconds) {
    super("Demasiadas solicitudes. Inténtalo más tarde.");
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public int retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
