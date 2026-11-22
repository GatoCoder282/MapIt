package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Referencia mínima al hecho original: sin PII, credenciales, texto libre ni payload arbitrario. */
public record NotificationEvent(
        UUID id,
        TenantId tenantId,
        NotificationType type,
        Instant occurredAt,
        UUID establishmentId,
        UUID reservationId) {
    public NotificationEvent {
        Objects.requireNonNull(id, "eventId no puede ser null");
        Objects.requireNonNull(tenantId, "tenantId no puede ser null");
        Objects.requireNonNull(type, "type no puede ser null");
        Objects.requireNonNull(occurredAt, "occurredAt no puede ser null");
        Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
        Objects.requireNonNull(reservationId, "reservationId no puede ser null");
        occurredAt = occurredAt.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }
}
