package com.mapit.reservations.domain.history;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Persistencia de enlaces de uso único y credenciales de lectura revocables. */
public interface CustomerHistoryAccessRepository {
  Optional<TenantId> activeTenant(String slug);

  void lockPerson(TenantId tenant, UUID person);

  long recentRequests(TenantId tenant, UUID person, Instant since);

  void issue(TenantId tenant, UUID person, String linkHash, Instant expires, Instant now);

  Optional<UUID> exchange(TenantId tenant, String linkHash, String sessionHash,
      Instant sessionExpires, Instant now);

  Optional<UUID> validSession(TenantId tenant, String sessionHash, Instant now);

  boolean revoke(TenantId tenant, String sessionHash, Instant now);
}
