package com.mapit.operations.application.notification;

import java.time.Clock;
import java.util.Objects;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.operations.domain.notification.NotificationScope;

/** Marcado masivo propio con un único corte del servidor, sin iteración sobre páginas. */
public class MarkAllMyNotificationsRead {
    private final NotificationRepository repository;
    private final CurrentNotificationScope currentScope;
    private final Clock clock;

    public MarkAllMyNotificationsRead(
            NotificationRepository repository, CurrentNotificationScope currentScope, Clock clock) {
        this.repository = Objects.requireNonNull(repository);
        this.currentScope = Objects.requireNonNull(currentScope);
        this.clock = Objects.requireNonNull(clock);
    }

    @Transactional
    public long execute() {
        NotificationScope scope = currentScope.require();
        long updated = repository.markAllRead(scope, clock.instant());
        if (updated < 0) {
            throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
        }
        return updated;
    }
}
