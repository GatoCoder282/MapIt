package com.mapit.identity.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Consultas y mutaciones condicionadas, siempre con tenant explícito. */
public interface TenantUserRepository {
  Optional<TenantUser> findById(TenantId tenant, UUID id);

  boolean tenantActive(TenantId tenant);

  long count(TenantId tenant);

  List<TenantUser> list(TenantId tenant, int size, long offset);

  boolean changeRole(TenantId tenant, UUID id, UserRole expected, UserRole next);

  boolean deactivate(TenantId tenant, UUID id, UserRole expected);
}
