package com.mapit.platform.domain;

/** Puerto para enviar el enlace de activación del primer ADMIN (CU-25). */
public interface AdminInvitationEmailPort {

  /**
   * Envía la invitación. El {@code activationUrl} contiene el token opaco;
   * nunca una contraseña temporal ni un JWT de sesión.
   */
  void send(Tenant tenant, String email, String activationUrl);
}
