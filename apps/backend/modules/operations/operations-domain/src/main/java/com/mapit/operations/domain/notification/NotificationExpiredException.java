package com.mapit.operations.domain.notification;

/** Una reentrega caducada/purgada no recrea contenido ni cuenta como entrega nueva. */
public final class NotificationExpiredException extends RuntimeException {
    public NotificationExpiredException() { super("La notificación ha caducado."); }
}
