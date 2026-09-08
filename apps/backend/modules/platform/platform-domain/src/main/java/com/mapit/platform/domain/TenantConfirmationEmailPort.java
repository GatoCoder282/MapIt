package com.mapit.platform.domain;

/** Puerto para notificar al administrador que el tenant fue registrado. */
public interface TenantConfirmationEmailPort {

  /** Envía la confirmación al destinatario indicado. */
  void send(Tenant tenant, String recipient);
}
