package com.mapit.platform.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Invitación del primer ADMIN (CU-25). El valor opaco del enlace es secreto y
 * nunca se persiste: solo su hash SHA-256. Un solo uso y caducidad de 24 h.
 */
public record InvitationToken(
    UUID id,
    TenantId tenantId,
    String email,
    String tokenHash,
    Instant expiresAt,
    Instant consumedAt,
    UUID userId) {

  /** Caducidad fija de la invitación (regla de CU-25). */
  public static final Duration INVITATION_TTL = Duration.ofHours(24);

  public InvitationToken {
    Objects.requireNonNull(id, "El id no puede ser null");
    Objects.requireNonNull(tenantId, "El tenant no puede ser null");
    Objects.requireNonNull(email, "El email no puede ser null");
    Objects.requireNonNull(tokenHash, "El hash del token no puede ser null");
    Objects.requireNonNull(expiresAt, "La caducidad no puede ser null");
  }

  /** Emite una invitación pendiente para el tenant y correo dados. */
  public static InvitationToken issue(TenantId tenantId, String email, String tokenHash, Instant now) {
    return new InvitationToken(
        UUID.randomUUID(), tenantId, email, tokenHash, now.plus(INVITATION_TTL), null, null);
  }
}
