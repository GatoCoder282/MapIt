package com.mapit.platform.domain;

/** Entrega el enlace de verificación sin exponer el token a la respuesta pública. */
public interface BusinessApplicationVerificationEmailPort {
  void send(String email, String businessName, String verificationUrl);
}
