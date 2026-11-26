package com.mapit.operations.domain.notification;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/** Keyset por creación e ID descendentes. Cambiar identidad o permisos invalida el cursor. */
public record NotificationPageRequest(
        NotificationScope scope, int limit, @Nullable NotificationCursor before) {
    public static final int MAX_LIMIT = 100;

    public NotificationPageRequest {
        Objects.requireNonNull(scope, "scope no puede ser null");
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new IllegalArgumentException("El límite debe estar entre 1 y 100");
        }
        if (before != null && !scope.equals(before.scope())) {
            throw new IllegalArgumentException("El cursor no corresponde al ámbito vigente");
        }
    }

    public boolean includes(Notification notification) {
        return scope.permits(notification) && (before == null || before.includes(notification));
    }
}
