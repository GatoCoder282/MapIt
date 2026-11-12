package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Operaciones transaccionales de plataforma que pueden afectar ADMIN activos. */
public interface AdminLifecycleRepository {
  boolean lockTenant(TenantId tenant);

  boolean lockActiveAdmin(TenantId tenant, UUID userId);

  /** Bloquea solo un ADMIN preexistente e inactivo, sin conceder privilegios. */
  boolean lockInactiveAdmin(TenantId tenant, UUID userId);

  /** Revalida ID y slug bajo el bloqueo global del tenant. */
  boolean lockRecoveryTenant(TenantId tenant, String slug);

  boolean lockPlatformAuthorizers(AuthenticatedPrincipal operator,
      AuthenticatedPrincipal approver);

  boolean lockPlatformOperator(AuthenticatedPrincipal operator);

  boolean lockPlatformOperator(UUID operatorId);

  Optional<String> inactiveAdminEmail(TenantId tenant, UUID userId);

  Optional<String> inactiveAdminPasswordHash(TenantId tenant, UUID userId);

  boolean recoverInactiveAdmin(TenantId tenant, UUID userId, String passwordHash, Instant cutoff);

  long activeAdmins(TenantId tenant);

  boolean deactivateAdmin(TenantId tenant, UUID userId);

  boolean changeAdminRole(TenantId tenant, UUID userId, UserRole nextRole);
}
