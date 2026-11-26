package com.mapit.operations.application.notification;

import java.time.Clock;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.operations.domain.notification.NotificationScope;

/** Lectura idempotente; el cliente solo identifica el aviso, no su destinatario ni la fecha. */
public class MarkMyNotificationRead {
    private final NotificationRepository repository;
    private final CurrentNotificationScope currentScope;
    private final Clock clock;

    public MarkMyNotificationRead(
            NotificationRepository repository, CurrentNotificationScope currentScope, Clock clock) {
        this.repository = Objects.requireNonNull(repository);
        this.currentScope = Objects.requireNonNull(currentScope);
        this.clock = Objects.requireNonNull(clock);
    }

    @Transactional
    public Optional<Notification> execute(UUID notificationId) {
        NotificationScope scope = currentScope.require();
        Objects.requireNonNull(notificationId, "notificationId no puede ser null");
        Optional<Notification> result = repository.markRead(scope, notificationId, clock.instant());
        if (result.isPresent()) {
            Notification notification = result.orElseThrow();
            if (!notificationId.equals(notification.id()) || !scope.permits(notification) || notification.isUnread()) {
                throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
            }
        }
        return result;
    }
}
