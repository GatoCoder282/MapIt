package com.mapit.identity.domain;

/** Presupuesto de cambio propio, separado del login; usar dirección real, no headers del cliente. */
public interface OwnPasswordAttemptLimiter {
  void checkPasswordChange(AuthenticatedPrincipal actor, String remoteAddress);
}
