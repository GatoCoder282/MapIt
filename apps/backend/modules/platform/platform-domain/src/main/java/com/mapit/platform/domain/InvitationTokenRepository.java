package com.mapit.platform.domain;

/** Puerto de persistencia de las invitaciones del primer ADMIN. */
public interface InvitationTokenRepository {

  /** Persiste la invitación pendiente dentro del tenant detallado. */
  void save(InvitationToken invitation);
}
