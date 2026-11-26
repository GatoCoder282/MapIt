package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

final class NotificationFixtures {
    static final TenantId TENANT = TenantId.of("notify-a");
    static final TenantId OTHER_TENANT = TenantId.of("notify-b");
    static final NotificationRecipient OWNER = new NotificationRecipient(TENANT, id(1));
    static final NotificationRecipient OTHER_USER = new NotificationRecipient(TENANT, id(2));
    static final NotificationRecipient OTHER_COMPANY = new NotificationRecipient(OTHER_TENANT, id(1));
    static final UUID ESTABLISHMENT = id(10);
    static final UUID OTHER_ESTABLISHMENT = id(11);
    static final UUID RESERVATION = id(20);
    static final Instant OCCURRED_AT = Instant.parse("2026-11-21T15:00:00Z");
    static final Instant CREATED_AT = OCCURRED_AT.plusSeconds(1);

    private NotificationFixtures() {}

    static UUID id(long value) {
        return new UUID(0, value);
    }

    static NotificationScope scope(NotificationRecipient recipient) {
        return new NotificationScope(recipient, Map.of(
                NotificationType.RESERVATION_CREATED, Set.of(ESTABLISHMENT),
                NotificationType.RESERVATION_CHECKED_IN, Set.of(ESTABLISHMENT)));
    }

    static Notification notice(long id, long eventId, NotificationRecipient recipient,
            NotificationType type, UUID establishment, Instant createdAt) {
        NotificationEvent event = new NotificationEvent(id(eventId), recipient.tenantId(), type,
                OCCURRED_AT, establishment, RESERVATION);
        return Notification.unread(id(id), recipient, event, createdAt);
    }

    static Notification notice(long id) {
        return notice(id, id, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
    }
}
