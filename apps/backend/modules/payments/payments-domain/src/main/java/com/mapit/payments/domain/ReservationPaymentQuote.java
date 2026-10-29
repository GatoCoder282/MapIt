package com.mapit.payments.domain;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Snapshot inmutable del primer intento; los reintentos no cambian precio ni vencimiento. */
public record ReservationPaymentQuote(UUID id, TenantId tenantId, UUID establishmentId, UUID reservationId,
    Money deposit, @Nullable Money total, int paymentWindowMinutes, Instant createdAt, Instant expiresAt) {}
