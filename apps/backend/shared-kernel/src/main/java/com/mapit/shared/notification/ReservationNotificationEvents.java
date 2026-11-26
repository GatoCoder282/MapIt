package com.mapit.shared.notification;

import java.time.Instant;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Hechos internos confirmados en la transacción de reserva; nunca payloads HTTP. */
public interface ReservationNotificationEvents {
    void record(UUID eventId, TenantId tenant, String type, Instant occurredAt, UUID establishmentId, UUID reservationId);
}
