package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Señal interna creada desde un cambio durable, con destinatario resuelto por el servidor. */
public record NotificationInvalidation(UUID eventId, NotificationRecipient recipient, Instant occurredAt) {
    public NotificationInvalidation {
        Objects.requireNonNull(eventId);
        Objects.requireNonNull(recipient);
        Objects.requireNonNull(occurredAt);
    }

    /** El ID canónico de la fila permite reintentar su creación sin un ID de envío aleatorio. */
    public static NotificationInvalidation created(Notification persisted) {
        Objects.requireNonNull(persisted);
        return new NotificationInvalidation(persisted.id(), persisted.recipient(), persisted.createdAt());
    }
}
