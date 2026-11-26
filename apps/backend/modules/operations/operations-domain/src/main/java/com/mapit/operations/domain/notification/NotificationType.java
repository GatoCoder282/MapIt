package com.mapit.operations.domain.notification;

/** Solo hechos existentes; declarar un tipo no conecta ni habilita su productor. */
public enum NotificationType {
    RESERVATION_CREATED("RESERVATION_CREATED", NotificationCategory.RESERVATIONS),
    RESERVATION_CHECKED_IN("reservation.checked_in", NotificationCategory.OPERATIONS);

    private final String sourceEventType;
    private final NotificationCategory category;

    NotificationType(String sourceEventType, NotificationCategory category) {
        this.sourceEventType = sourceEventType;
        this.category = category;
    }

    public String sourceEventType() {
        return sourceEventType;
    }

    public NotificationCategory category() {
        return category;
    }
}
