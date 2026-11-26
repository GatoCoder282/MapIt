package com.mapit.operations.application.notification;

/** Error sin identificadores ni datos del principal, independiente de HTTP. */
public final class NotificationAuthenticationRequiredException extends RuntimeException {
    public NotificationAuthenticationRequiredException() {
        super("Se requiere una identidad autenticada para consultar notificaciones");
    }
}
