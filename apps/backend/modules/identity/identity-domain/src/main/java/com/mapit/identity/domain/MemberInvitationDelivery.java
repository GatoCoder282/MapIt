package com.mapit.identity.domain;

import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Despacho post-commit; devuelve solo el resultado SMTP conocido, nunca la entrega. */
public interface MemberInvitationDelivery {
  enum Status { SEND_REQUESTED, SMTP_ACCEPTED, SMTP_FAILED, UNKNOWN }

  Status deliver(TenantId tenant, UUID invitationId, String tenantName,
      String email, String activationUrl);
}
