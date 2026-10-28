package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Un intento conserva su precio y comercio aun cuando cambie la configuración del método. */
public record Payment(
    UUID id, TenantId tenantId, UUID establishmentId, UUID reservationId, UUID methodId,
    PaymentProvider provider, String merchantReference, String externalReference, Money money,
    Status status, Instant createdAt, Instant expiresAt, @Nullable Instant verifiedAt,
    @Nullable UUID verifiedBy, @Nullable String verificationSource) {

  public enum Status {
    PENDING, PENDING_MANUAL_VERIFICATION, CONFIRMED, FAILED, EXPIRED, CANCELLED, RECONCILIATION_REQUIRED
  }

  public enum Outcome { CONFIRMED, FAILED, EXPIRED, CANCELLED }

  public Payment {
    Objects.requireNonNull(id); Objects.requireNonNull(tenantId);
    Objects.requireNonNull(establishmentId); Objects.requireNonNull(reservationId);
    Objects.requireNonNull(methodId); Objects.requireNonNull(provider);
    Objects.requireNonNull(money); Objects.requireNonNull(status);
    Objects.requireNonNull(createdAt); Objects.requireNonNull(expiresAt);
    if (!expiresAt.isAfter(createdAt)) throw new IllegalArgumentException("Vencimiento inválido");
    if (merchantReference == null || merchantReference.isBlank() || merchantReference.length() > 120
        || externalReference == null || externalReference.isBlank() || externalReference.length() > 120) {
      throw new IllegalArgumentException("Referencia de pago inválida");
    }
  }

  public Payment apply(Outcome outcome, Instant now, boolean reservationConfirmed,
      String source, @Nullable UUID actor) {
    if (status == Status.CONFIRMED || status == Status.RECONCILIATION_REQUIRED) return this;
    Status next;
    if (outcome == Outcome.CONFIRMED) {
      next = status == Status.PENDING || status == Status.PENDING_MANUAL_VERIFICATION
          ? (now.isBefore(expiresAt) && reservationConfirmed ? Status.CONFIRMED : Status.RECONCILIATION_REQUIRED)
          : Status.RECONCILIATION_REQUIRED;
    } else {
      if (status == Status.FAILED || status == Status.EXPIRED || status == Status.CANCELLED) return this;
      next = Status.valueOf(outcome.name());
    }
    boolean paid = outcome == Outcome.CONFIRMED;
    return new Payment(id, tenantId, establishmentId, reservationId, methodId, provider,
        merchantReference, externalReference, money, next, createdAt, expiresAt,
        paid ? now : null, paid ? actor : null, paid ? source : null);
  }
}
