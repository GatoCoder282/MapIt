package com.mapit.identity.domain;

import java.time.Instant;
import java.util.UUID;

/** Estado seguro de una invitación; nunca incluye el token original. */
public record MemberInvitation(
    UUID id, String email, UserRole role, Instant expiresAt,
    Instant consumedAt, Instant revokedAt, String dispatchStatus, Instant dispatchAttemptedAt) {
  public boolean pending() {
    return consumedAt == null && revokedAt == null;
  }
}
