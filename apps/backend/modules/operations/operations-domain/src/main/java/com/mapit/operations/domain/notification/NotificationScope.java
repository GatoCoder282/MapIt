package com.mapit.operations.domain.notification;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Ámbito obligatorio de bandeja, construido por aplicación desde identidad y permisos vigentes.
 * No autentica por sí mismo y nunca se deserializa del cliente. Sin concesiones deniega todo.
 */
public record NotificationScope(
        NotificationRecipient recipient,
        Map<NotificationType, Set<UUID>> establishmentsByType) {
    public NotificationScope {
        Objects.requireNonNull(recipient, "recipient no puede ser null");
        Objects.requireNonNull(establishmentsByType, "establishmentsByType no puede ser null");
        Map<NotificationType, Set<UUID>> grants = new EnumMap<>(NotificationType.class);
        establishmentsByType.forEach((type, establishments) -> grants.put(
                Objects.requireNonNull(type, "type no puede ser null"),
                Set.copyOf(establishments)));
        establishmentsByType = Map.copyOf(grants);
    }

    public boolean permits(Notification notification) {
        Objects.requireNonNull(notification, "notification no puede ser null");
        return recipient.equals(notification.recipient())
                && establishmentsByType.getOrDefault(notification.event().type(), Set.of())
                        .contains(notification.event().establishmentId());
    }
}
