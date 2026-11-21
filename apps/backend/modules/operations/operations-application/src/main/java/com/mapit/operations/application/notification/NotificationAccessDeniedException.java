package com.mapit.operations.application.notification;

/** Denegación segura sin revelar usuario, tenant, permisos ni existencia de avisos. */
public final class NotificationAccessDeniedException extends RuntimeException {
    public NotificationAccessDeniedException() {
        super("Acceso a notificaciones no autorizado");
    }
}
