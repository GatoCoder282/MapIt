package com.mapit.identity.domain;

/** Entrega exclusiva al correo persistido del ADMIN destinatario. */
public interface AdminRecoveryMail {
  void send(String email, String tenantSlug, String token);
}
