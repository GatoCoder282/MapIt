package com.mapit.operations.application.notification;

import java.util.Objects;

import org.jspecify.annotations.Nullable;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.NotificationCursor;
import com.mapit.operations.domain.notification.NotificationPage;
import com.mapit.operations.domain.notification.NotificationPageRequest;
import com.mapit.operations.domain.notification.NotificationRepository;

/** Consulta propia por cursor. Sin registro automático hasta disponer de adaptadores reales. */
public class ListMyNotifications {
    private final NotificationRepository repository;
    private final CurrentNotificationScope currentScope;

    public ListMyNotifications(NotificationRepository repository, CurrentNotificationScope currentScope) {
        this.repository = Objects.requireNonNull(repository);
        this.currentScope = Objects.requireNonNull(currentScope);
    }

    @Transactional(readOnly = true)
    public NotificationPage execute(int limit, @Nullable NotificationCursor before) {
        NotificationPageRequest request = new NotificationPageRequest(currentScope.require(), limit, before);
        NotificationPage result = repository.list(request);
        if (!request.equals(result.request())) {
            throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
        }
        return result;
    }
}
