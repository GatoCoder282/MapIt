package com.mapit.operations.domain.notification;

import java.util.Objects;
import java.util.UUID;

/** Unicidad por tenant, usuario, evento estable y tipo; no por intento de entrega. */
public record NotificationKey(
        NotificationRecipient recipient, UUID sourceEventId, NotificationType type) {
    public NotificationKey {
        Objects.requireNonNull(recipient, "recipient no puede ser null");
        Objects.requireNonNull(sourceEventId, "sourceEventId no puede ser null");
        Objects.requireNonNull(type, "type no puede ser null");
    }
}
