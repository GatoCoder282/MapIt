package com.mapit.operations.infrastructure.realtime;

import java.util.Objects;
import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.mapit.operations.domain.notification.NotificationInvalidation;
import com.mapit.operations.domain.notification.NotificationInvalidationPublisher;
import com.mapit.operations.domain.notification.NotificationRecipient;

/**
 * Adaptador preparado, deliberadamente sin bean ni consumidor/scheduler.
 * No habilitar antes de persistencia y principal privado/autorización CONNECT/SUBSCRIBE/outbound.
 */
public final class StompNotificationInvalidationPublisher implements NotificationInvalidationPublisher {
    public static final String USER_DESTINATION = "/user/topic/notifications";
    private static final String BROKER_DESTINATION = "/topic/notifications";
    private final SimpMessagingTemplate broker;

    public StompNotificationInvalidationPublisher(SimpMessagingTemplate broker) {
        this.broker = Objects.requireNonNull(broker);
    }

    @Override
    public void publish(NotificationInvalidation invalidation) {
        Objects.requireNonNull(invalidation);
        broker.convertAndSendToUser(principalName(invalidation.recipient()), BROKER_DESTINATION,
                new Envelope(invalidation.eventId(), "notification.inbox.invalidated.v1", 1, invalidation.occurredAt().toString()));
    }

    /** Contrato de routing servidor; bootstrap debe enlazarlo con la identidad vigente de MAP-238. */
    public static String principalName(NotificationRecipient recipient) {
        Objects.requireNonNull(recipient);
        return "staff:" + recipient.tenantId().value() + ":" + recipient.userId();
    }

    public record Envelope(UUID eventId, String eventType, int schemaVersion, String occurredAt) {}
}
