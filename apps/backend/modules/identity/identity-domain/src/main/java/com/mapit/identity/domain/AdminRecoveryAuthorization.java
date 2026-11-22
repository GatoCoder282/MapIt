package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Alcance inmutable de una solicitud excepcional; nunca contiene credenciales. */
public record AdminRecoveryAuthorization(UUID id, TenantId targetTenant, String targetSlug,
    UUID targetUser, UUID operator, String ticket, String reason, Instant validFrom,
    Instant expiresAt) {
  public AdminRecoveryAuthorization {
    Objects.requireNonNull(id);
    Objects.requireNonNull(targetTenant);
    Objects.requireNonNull(targetUser);
    Objects.requireNonNull(operator);
    Objects.requireNonNull(validFrom);
    Objects.requireNonNull(expiresAt);
    if ("platform".equals(targetTenant.value()) || targetSlug == null || targetSlug.isBlank()
        || ticket == null || ticket.isBlank() || ticket.length() > 120
        || reason == null || reason.isBlank() || reason.length() > 500
        || !expiresAt.isAfter(validFrom)) {
      throw new IllegalArgumentException("Alcance de recuperación inválido");
    }
  }
}
