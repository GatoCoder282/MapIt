package com.mapit.operations.application.notification;

import java.util.Objects;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.NotificationRepository;

/** Recuento autorizado; un fallo no se presenta como un contador cero. */
public class CountMyUnreadNotifications {
    private final NotificationRepository repository;
    private final CurrentNotificationScope currentScope;

    public CountMyUnreadNotifications(NotificationRepository repository, CurrentNotificationScope currentScope) {
        this.repository = Objects.requireNonNull(repository);
        this.currentScope = Objects.requireNonNull(currentScope);
    }

    @Transactional(readOnly = true)
    public long execute() {
        long count = repository.countUnread(currentScope.require());
        if (count < 0) {
            throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
        }
        return count;
    }
}
