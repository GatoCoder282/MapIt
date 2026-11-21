package com.mapit.operations.application.notification;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationRepository;

/**
 * Procesa un hecho confirmado de origen interno, sin flags ni entrega de transporte.
 * Registro como bean y consumidor durable pendientes de adaptadores reales.
 */
public class ProcessNotificationEvent {
    private final ResolveNotificationRecipients recipients;
    private final NotificationRepository repository;
    private final Clock clock;

    public ProcessNotificationEvent(
            ResolveNotificationRecipients recipients, NotificationRepository repository, Clock clock) {
        this.recipients = Objects.requireNonNull(recipients);
        this.repository = Objects.requireNonNull(repository);
        this.clock = Objects.requireNonNull(clock);
    }

    /** Devuelve avisos canónicos por destinatario, no una cantidad de inserciones nuevas. */
    @Transactional
    public List<Notification> execute(NotificationEvent event) {
        Objects.requireNonNull(event, "event no puede ser null");
        Instant createdAt = clock.instant();
        if (createdAt.isBefore(event.occurredAt())) {
            throw new IllegalArgumentException("El evento no puede ser posterior al procesamiento");
        }
        List<Notification> pending = recipients.execute(event).stream()
                .map(recipient -> Notification.unread(UUID.randomUUID(), recipient, event, createdAt)).toList();
        List<Notification> canonical = new ArrayList<>(pending.size());
        for (Notification candidate : pending) {
            Notification stored = repository.createIfAbsent(candidate);
            if (!candidate.key().equals(stored.key()) || !event.equals(stored.event())) {
                throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
            }
            canonical.add(stored);
        }
        return List.copyOf(canonical);
    }
}
