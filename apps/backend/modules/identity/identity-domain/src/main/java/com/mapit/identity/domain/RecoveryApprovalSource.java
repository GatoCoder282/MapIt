package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Evidencia independiente del request del operador. */
public interface RecoveryApprovalSource {
  Optional<Approval> find(String reference);

  /** Conserva compatibilidad con autorizaciones documentales anteriores a V37. */
  boolean isRevokedIfRegistered(String reference);

  record Approval(String reference, String responsible, Instant approvedAt,
      Instant validFrom, Instant expiresAt, TenantId targetTenant, String targetSlug,
      UUID targetUser, String ticket, String reason) {}
}
