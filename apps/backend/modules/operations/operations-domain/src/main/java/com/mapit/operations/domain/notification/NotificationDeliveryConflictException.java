package com.mapit.operations.domain.notification;

/** Conflicto de idempotencia no reintentable; sin datos del evento ni del destinatario. */
public final class NotificationDeliveryConflictException extends RuntimeException {
    public NotificationDeliveryConflictException() { super("Conflicto de entrega"); }
}
