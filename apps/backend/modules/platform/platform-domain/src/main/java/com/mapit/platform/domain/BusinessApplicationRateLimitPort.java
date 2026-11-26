package com.mapit.platform.domain;

/** Presupuesto compartido para las rutas públicas de solicitud y verificación. */
public interface BusinessApplicationRateLimitPort {
  void checkSubmission(String remoteAddress, String normalizedEmail);

  void checkVerification(String remoteAddress);
}
