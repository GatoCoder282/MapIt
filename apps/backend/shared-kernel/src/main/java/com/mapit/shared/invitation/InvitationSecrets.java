package com.mapit.shared.invitation;

/** Capacidad criptográfica común a CU-25 y las invitaciones MEMBER. */
public interface InvitationSecrets {
  String newToken();

  String hash(String token);
}
