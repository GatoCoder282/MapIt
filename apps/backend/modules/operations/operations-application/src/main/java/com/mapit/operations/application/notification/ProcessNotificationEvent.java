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
 * Invocado por el consumidor durable; las señales se publican en una fase posterior al commit.
 */
public class ProcessNotificationEvent {
    private final ResolveNotificationRecipients recipients;
    private final NotificationRepository repository;
    private final Clock clock;
    private final java.util.function.BiPredicate<com.mapit.operations.domain.notification.NotificationRecipient, com.mapit.operations.domain.notification.NotificationCategory> preference;

    public ProcessNotificationEvent(
            ResolveNotificationRecipients recipients, NotificationRepository repository, Clock clock) {
        this(recipients, repository, clock, (recipient, category) -> true);
    }

    public ProcessNotificationEvent(ResolveNotificationRecipients recipients, NotificationRepository repository, Clock clock,
            java.util.function.BiPredicate<com.mapit.operations.domain.notification.NotificationRecipient, com.mapit.operations.domain.notification.NotificationCategory> preference) {
        this.preference = Objects.requireNonNull(preference);
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
                .filter(recipient -> preference.test(recipient,event.type().category()))
                .map(recipient -> Notification.unread(UUID.randomUUID(), recipient, event, createdAt)).toList();
        List<Notification> canonical = new ArrayList<>(pending.size());
        for (Notification candidate : pending) {
            Notification stored;
            try { stored = repository.createIfAbsent(candidate); }
            catch (com.mapit.operations.domain.notification.NotificationExpiredException expired) { continue; }
            if (!candidate.key().equals(stored.key()) || !event.equals(stored.event())) {
                throw new IllegalStateException("Respuesta inválida del repositorio de notificaciones");
            }
            canonical.add(stored);
        }
        return List.copyOf(canonical);
    }
}
