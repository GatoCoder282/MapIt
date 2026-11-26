package com.mapit.operations.infrastructure.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.mapit.operations.domain.notification.NotificationInvalidation;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.json.JsonMapper;

class StompNotificationInvalidationPublisherTest {
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final StompNotificationInvalidationPublisher publisher = new StompNotificationInvalidationPublisher(broker);
    private final UUID user = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private final NotificationInvalidation signal = new NotificationInvalidation(UUID.randomUUID(),
            new NotificationRecipient(TenantId.of("tenant-a"), user), Instant.parse("2026-11-22T12:00:00Z"));

    @Test
    void sendsOnlyMinimalInvalidationToTenantQualifiedUserUsingExistingBroker() {
        publisher.publish(signal);
        publisher.publish(signal);
        var payload = ArgumentCaptor.forClass(StompNotificationInvalidationPublisher.Envelope.class);
        verify(broker, times(2)).convertAndSendToUser(eq("staff:tenant-a:" + user), eq("/topic/notifications"), payload.capture());
        assertThat(payload.getAllValues().get(0)).isEqualTo(payload.getAllValues().get(1));
        String json = JsonMapper.builder().build().writeValueAsString(payload.getValue());
        assertThat(json).contains("notification.inbox.invalidated.v1", signal.eventId().toString())
                .doesNotContain("tenant-a", user.toString(), "email", "reservation", "unreadCount");
        assertThat(JsonMapper.builder().build().readTree(json).size()).isEqualTo(4);
        assertThat(JsonMapper.builder().build().readTree(json).get("occurredAt").asString()).isEqualTo("2026-11-22T12:00:00Z");
    }

    @Test
    void sameUuidInDifferentTenantAndDifferentUserHaveDifferentRoutes() {
        var otherTenant = new NotificationRecipient(TenantId.of("tenant-b"), user);
        var otherUser = new NotificationRecipient(TenantId.of("tenant-a"), UUID.randomUUID());
        assertThat(StompNotificationInvalidationPublisher.principalName(otherTenant))
                .isNotEqualTo(StompNotificationInvalidationPublisher.principalName(signal.recipient()));
        assertThat(StompNotificationInvalidationPublisher.principalName(otherUser))
                .isNotEqualTo(StompNotificationInvalidationPublisher.principalName(signal.recipient()));
    }

    @Test
    void doesNotTurnBrokerFailureIntoSuccessfulDelivery() {
        doThrow(new MessageDeliveryException("broker unavailable")).when(broker).convertAndSendToUser(any(), any(), any());
        assertThatThrownBy(() -> publisher.publish(signal)).isInstanceOf(MessageDeliveryException.class);
    }
}
