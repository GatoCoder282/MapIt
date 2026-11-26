package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Posición interna, vinculada al ámbito completo. No es un cursor HTTP aceptado del cliente. */
public record NotificationCursor(
        NotificationScope scope, Instant createdAt, UUID notificationId) {
    public NotificationCursor {
        Objects.requireNonNull(scope, "scope no puede ser null");
        Objects.requireNonNull(createdAt, "createdAt no puede ser null");
        Objects.requireNonNull(notificationId, "notificationId no puede ser null");
    }

    public boolean includes(Notification notification) {
        Objects.requireNonNull(notification, "notification no puede ser null");
        return scope.permits(notification)
                && (notification.createdAt().isBefore(createdAt)
                        || notification.createdAt().equals(createdAt)
                                && notification.id().toString().compareTo(notificationId.toString()) < 0);
    }
}
