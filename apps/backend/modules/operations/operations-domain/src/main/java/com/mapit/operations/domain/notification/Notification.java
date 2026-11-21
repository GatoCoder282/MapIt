package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Comparator;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** Aviso inmutable de un solo destinatario. Su categoría se deriva siempre del hecho admitido. */
public record Notification(
        UUID id,
        NotificationRecipient recipient,
        NotificationEvent event,
        Instant createdAt,
        @Nullable Instant readAt) {

    /** UUID canónico evita el orden signed de UUID.compareTo, distinto del UUID de PostgreSQL. */
    public static final Comparator<Notification> NEWEST_FIRST = Comparator
            .comparing(Notification::createdAt)
            .thenComparing(notification -> notification.id().toString())
            .reversed();

    public Notification {
        Objects.requireNonNull(id, "id no puede ser null");
        Objects.requireNonNull(recipient, "recipient no puede ser null");
        Objects.requireNonNull(event, "event no puede ser null");
        Objects.requireNonNull(createdAt, "createdAt no puede ser null");
        if (!recipient.tenantId().equals(event.tenantId())) {
            throw new IllegalArgumentException("El evento y el destinatario deben pertenecer al mismo tenant");
        }
        if (createdAt.isBefore(event.occurredAt())) {
            throw new IllegalArgumentException("La creación no puede preceder al evento");
        }
        if (readAt != null && readAt.isBefore(createdAt)) {
            throw new IllegalArgumentException("La lectura no puede preceder a la creación");
        }
    }

    public static Notification unread(
            UUID id, NotificationRecipient recipient, NotificationEvent event, Instant createdAt) {
        return new Notification(id, recipient, event, createdAt, null);
    }

    public NotificationCategory category() {
        return event.type().category();
    }

    public NotificationKey key() {
        return new NotificationKey(recipient, event.id(), event.type());
    }

    public boolean isUnread() {
        return readAt == null;
    }

    /** No visible y no existente comparten resultado vacío en el repositorio; sin IDs en errores. */
    public Optional<Notification> markRead(NotificationScope scope, Instant at) {
        Objects.requireNonNull(scope, "scope no puede ser null");
        Objects.requireNonNull(at, "at no puede ser null");
        if (!scope.permits(this)) return Optional.empty();
        if (at.isBefore(createdAt)) {
            throw new IllegalArgumentException("La lectura no puede preceder a la creación");
        }
        return Optional.of(readAt == null ? new Notification(id, recipient, event, createdAt, at) : this);
    }
}
