package com.mapit.platform.domain;

/** Notifica el resultado confirmado al contacto sin credenciales ni datos internos. */
public interface BusinessApplicationDecisionEmailPort {
  void send(String email, String businessName, BusinessApplicationStatus status);
}
