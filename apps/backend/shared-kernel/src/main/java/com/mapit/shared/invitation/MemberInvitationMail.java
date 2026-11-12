package com.mapit.shared.invitation;

/** Enlace efímero: solo debe existir en memoria hasta llamar al transporte SMTP. */
public interface MemberInvitationMail {
  void send(String tenantName, String email, String activationUrl);
}
