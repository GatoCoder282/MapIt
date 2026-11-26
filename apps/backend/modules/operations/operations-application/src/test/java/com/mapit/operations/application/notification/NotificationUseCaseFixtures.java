package com.mapit.operations.application.notification;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationKey;
import com.mapit.operations.domain.notification.NotificationPage;
import com.mapit.operations.domain.notification.NotificationPageRequest;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.operations.domain.notification.NotificationType;
import com.mapit.shared.tenant.TenantId;

final class NotificationUseCaseFixtures {
    static final TenantId TENANT = TenantId.of("notify-a");
    static final TenantId OTHER_TENANT = TenantId.of("notify-b");
    static final NotificationRecipient OWNER = new NotificationRecipient(TENANT, id(1));
    static final NotificationRecipient OTHER_USER = new NotificationRecipient(TENANT, id(2));
    static final NotificationRecipient OTHER_COMPANY = new NotificationRecipient(OTHER_TENANT, id(1));
    static final UUID ESTABLISHMENT = id(10);
    static final UUID OTHER_ESTABLISHMENT = id(11);
    static final Instant CREATED_AT = Instant.parse("2026-11-21T15:00:00Z");
    static final Instant NOW = CREATED_AT.plusSeconds(10);
    static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    static final Map<NotificationType, Set<UUID>> GRANTS = Map.of(
            NotificationType.RESERVATION_CREATED, Set.of(ESTABLISHMENT),
            NotificationType.RESERVATION_CHECKED_IN, Set.of(ESTABLISHMENT));

    private NotificationUseCaseFixtures() {}

    static UUID id(long value) {
        return new UUID(0, value);
    }

    static NotificationScope scope(NotificationRecipient recipient) {
        return new NotificationScope(recipient, GRANTS);
    }

    static Notification notice(long id, NotificationRecipient recipient, NotificationType type,
            UUID establishment, Instant createdAt) {
        return Notification.unread(id(id), recipient,
                new NotificationEvent(id(id), recipient.tenantId(), type, CREATED_AT.minusSeconds(1),
                        establishment, id(20)), createdAt);
    }

    static Notification notice(long id) {
        return notice(id, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
    }

    /** Doble exclusivo de unit tests; no acredita SQL, RLS ni transacciones reales. */
    static final class Repository implements NotificationRepository {
        final Map<NotificationKey, Notification> rows = new HashMap<>();
        int listCalls;
        int countCalls;
        int markCalls;
        int markAllCalls;
        NotificationScope lastScope;
        Instant lastReadAt;
        NotificationPage overridePage;
        Long overrideCount;
        Optional<Notification> overrideRead;
        Long overrideAll;
        Runnable afterBulkSnapshot = () -> {};

        void seed(Notification... notifications) {
            for (Notification notification : notifications) rows.put(notification.key(), notification);
        }

        @Override
        public Notification createIfAbsent(Notification notification) {
            throw new UnsupportedOperationException("Los casos de consulta/marcado no crean notificaciones");
        }

        @Override
        public NotificationPage list(NotificationPageRequest request) {
            listCalls++;
            lastScope = request.scope();
            if (overridePage != null) return overridePage;
            List<Notification> visible = rows.values().stream().filter(request::includes)
                    .sorted(Notification.NEWEST_FIRST).limit(request.limit() + 1L).toList();
            return new NotificationPage(request, visible.subList(0, Math.min(request.limit(), visible.size())),
                    visible.size() > request.limit());
        }

        @Override
        public long countUnread(NotificationScope scope) {
            countCalls++;
            lastScope = Objects.requireNonNull(scope);
            if (overrideCount != null) return overrideCount;
            return rows.values().stream().filter(scope::permits).filter(Notification::isUnread).count();
        }

        @Override
        public Optional<Notification> markRead(NotificationScope scope, UUID notificationId, Instant readAt) {
            markCalls++;
            lastScope = scope;
            lastReadAt = readAt;
            if (overrideRead != null) return overrideRead;
            Optional<Notification> result = rows.values().stream()
                    .filter(row -> row.id().equals(notificationId)).filter(scope::permits).findFirst()
                    .flatMap(row -> row.markRead(scope, readAt));
            result.ifPresent(notification -> rows.put(notification.key(), notification));
            return result;
        }

        @Override
        public long markAllRead(NotificationScope scope, Instant readAt) {
            markAllCalls++;
            lastScope = scope;
            lastReadAt = readAt;
            if (overrideAll != null) return overrideAll;
            List<Notification> snapshot = rows.values().stream().filter(scope::permits)
                    .filter(Notification::isUnread).filter(row -> !row.createdAt().isAfter(readAt)).toList();
            afterBulkSnapshot.run();
            for (Notification notification : snapshot) {
                Notification read = notification.markRead(scope, readAt).orElseThrow();
                rows.put(read.key(), read);
            }
            return snapshot.size();
        }

        int calls() {
            return listCalls + countCalls + markCalls + markAllCalls;
        }
    }
}
