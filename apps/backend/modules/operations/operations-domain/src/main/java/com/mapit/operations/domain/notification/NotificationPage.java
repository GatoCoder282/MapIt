package com.mapit.operations.domain.notification;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Página inmutable que rechaza datos fuera del ámbito, repetidos o fuera de orden. */
public record NotificationPage(
        NotificationPageRequest request, List<Notification> content, boolean hasMore) {
    public NotificationPage {
        Objects.requireNonNull(request, "request no puede ser null");
        content = List.copyOf(content);
        if (content.size() > request.limit() || hasMore && content.isEmpty()) {
            throw new IllegalArgumentException("La página no respeta el límite o la continuación");
        }
        Set<UUID> ids = new HashSet<>();
        Set<NotificationKey> keys = new HashSet<>();
        for (int i = 0; i < content.size(); i++) {
            Notification current = content.get(i);
            if (!request.includes(current)) {
                throw new IllegalArgumentException("La página contiene una notificación fuera del ámbito solicitado");
            }
            if (!ids.add(current.id()) || !keys.add(current.key())) {
                throw new IllegalArgumentException("La página contiene notificaciones duplicadas");
            }
            if (i > 0 && Notification.NEWEST_FIRST.compare(content.get(i - 1), current) > 0) {
                throw new IllegalArgumentException("La página no está ordenada por creación e ID descendentes");
            }
        }
    }

    public Optional<NotificationCursor> nextCursor() {
        if (!hasMore) return Optional.empty();
        Notification last = content.getLast();
        return Optional.of(new NotificationCursor(request.scope(), last.createdAt(), last.id()));
    }
}
