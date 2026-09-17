package com.mapit.identity.domain;

import java.time.Instant;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Estado persistido de una invitación, con sus marcas de ciclo de vida. */
public record StoredInvitation(
    UUID id,
    TenantId tenantId,
    String email,
    Instant expiresAt,
    Instant consumedAt) {

  public boolean isUsed() {
    return consumedAt != null;
  }
}
