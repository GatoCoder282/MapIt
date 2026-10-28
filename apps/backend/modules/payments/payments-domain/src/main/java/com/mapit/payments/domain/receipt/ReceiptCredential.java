package com.mapit.payments.domain.receipt;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/**
 * Descriptor persistible de una credencial, separado de los estados actuales de reserva y pago.
 * La validación positiva solo identifica la reserva; no autoriza su llegada u ocupación.
 */
public record ReceiptCredential(
    TenantId tenantId,
    UUID reservationId,
    String tokenHash,
    Instant issuedAt,
    Instant expiresAt,
    @Nullable Instant revokedAt) {

  public ReceiptCredential {
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(reservationId, "reservationId no puede ser null");
    ReceiptToken.requireHash(tokenHash);
    Objects.requireNonNull(issuedAt, "issuedAt no puede ser null");
    Objects.requireNonNull(expiresAt, "expiresAt no puede ser null");
    if (!expiresAt.isAfter(issuedAt)) {
      throw new IllegalArgumentException("La credencial debe expirar después de su emisión");
    }
    if (revokedAt != null && revokedAt.isBefore(issuedAt)) {
      throw new IllegalArgumentException("La revocación no puede preceder a la emisión");
    }
  }

  public boolean accepts(
      TenantId operatorTenant, UUID expectedReservation, String presentedToken, Instant now) {
    Objects.requireNonNull(now, "now no puede ser null");
    return tenantId.equals(operatorTenant)
        && reservationId.equals(expectedReservation)
        && revokedAt == null
        && !now.isBefore(issuedAt)
        && now.isBefore(expiresAt)
        && ReceiptToken.matches(presentedToken, tokenHash);
  }

  /** La revocación es irreversible; repetirla conserva el primer instante registrado. */
  public ReceiptCredential revoke(Instant now) {
    Objects.requireNonNull(now, "now no puede ser null");
    if (revokedAt != null) {
      return this;
    }
    return new ReceiptCredential(tenantId, reservationId, tokenHash, issuedAt, expiresAt, now);
  }
}
