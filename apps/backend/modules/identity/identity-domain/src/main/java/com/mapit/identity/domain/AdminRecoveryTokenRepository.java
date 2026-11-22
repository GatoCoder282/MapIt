package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Token opaco de un solo uso ligado por FK a una autorización V33. */
public interface AdminRecoveryTokenRepository {
  void issue(UUID authorizationId, String tokenHash, Instant expiresAt);

  Optional<UUID> lockUsable(String tokenHash, Instant at);

  boolean consume(String tokenHash, Instant at);
}
