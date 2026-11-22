package com.mapit.shared.security;

import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Autorización de local validada en backend; una preferencia de navegador no concede acceso. */
public interface EstablishmentAuthorizationPort {
  /** Administración de asignaciones y configuración: solo ADMIN. */
  default boolean canManageStaff(TenantId tenantId, UUID actorId, UUID establishmentId) { return false; }
  boolean canManagePayments(TenantId tenantId, UUID actorId, UUID establishmentId);
  boolean canCheckIn(TenantId tenantId, UUID actorId, UUID establishmentId);
  boolean canReadOperations(TenantId tenantId, UUID actorId, UUID establishmentId);
}
