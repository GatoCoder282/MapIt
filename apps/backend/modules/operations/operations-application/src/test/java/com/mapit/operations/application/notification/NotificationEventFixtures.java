package com.mapit.operations.application.notification;

import static com.mapit.operations.application.notification.NotificationUseCaseFixtures.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationKey;
import com.mapit.operations.domain.notification.NotificationPage;
import com.mapit.operations.domain.notification.NotificationPageRequest;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationRecipientCandidatesPort;
import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.operations.domain.notification.NotificationType;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantId;

/** Dobles exclusivos de tests: no son adaptadores, productores ni estado de negocio productivo. */
final class NotificationEventFixtures {
    private NotificationEventFixtures() {}

    static NotificationEvent event(NotificationType type) {
        return new NotificationEvent(id(30), TENANT, type, CREATED_AT, ESTABLISHMENT, id(20));
    }

    static final class RecipientPorts implements NotificationRecipientCandidatesPort,
            NotificationAuthorizationPort, EstablishmentAuthorizationPort {
        List<NotificationRecipient> candidates = List.of(OWNER);
        final List<NotificationRecipient> authorizationCalls = new ArrayList<>();
        final Map<NotificationRecipient, NotificationScope> scopes = new HashMap<>();
        final Set<NotificationRecipient> denied = new HashSet<>();
        NotificationRecipient failAuthorizationFor;
        NotificationEvent lastEvent;
        int candidateCalls;
        int readCalls;
        int checkInCalls;
        boolean canRead = true;
        boolean canCheckIn = true;
        TenantId checkedTenant;
        UUID checkedUser;
        UUID checkedEstablishment;

        @Override
        public List<NotificationRecipient> findCandidates(NotificationEvent event) {
            candidateCalls++;
            lastEvent = event;
            return candidates;
        }

        @Override
        public Optional<NotificationScope> resolve(NotificationRecipient authenticated) {
            authorizationCalls.add(authenticated);
            if (authenticated.equals(failAuthorizationFor)) {
                throw new IllegalStateException("Autorización no disponible");
            }
            if (denied.contains(authenticated)) return Optional.empty();
            return Optional.of(scopes.getOrDefault(authenticated, scope(authenticated)));
        }

        @Override
        public boolean canReadOperations(TenantId tenantId, UUID actorId, UUID establishmentId) {
            readCalls++;
            checkedTenant = tenantId;
            checkedUser = actorId;
            checkedEstablishment = establishmentId;
            return canRead;
        }

        @Override
        public boolean canCheckIn(TenantId tenantId, UUID actorId, UUID establishmentId) {
            checkInCalls++;
            checkedTenant = tenantId;
            checkedUser = actorId;
            checkedEstablishment = establishmentId;
            return canCheckIn;
        }

        @Override
        public boolean canManagePayments(TenantId tenantId, UUID actorId, UUID establishmentId) {
            throw new AssertionError("El permiso financiero no autoriza estos avisos");
        }

        ResolveNotificationRecipients resolver() {
            return new ResolveNotificationRecipients(this, this, this);
        }
    }

    static final class CreationRepository implements NotificationRepository {
        final Map<NotificationKey, Notification> rows = new HashMap<>();
        int createCalls;
        Notification overrideResult;

        @Override
        public Notification createIfAbsent(Notification notification) {
            createCalls++;
            if (overrideResult != null) return overrideResult;
            Notification existing = rows.get(notification.key());
            if (existing != null) {
                if (!existing.event().equals(notification.event())) {
                    throw new IllegalArgumentException("Reentrega incompatible");
                }
                return existing;
            }
            rows.put(notification.key(), notification);
            return notification;
        }

        @Override
        public NotificationPage list(NotificationPageRequest request) {
            throw new AssertionError("El procesado no lista bandejas");
        }

        @Override
        public long countUnread(NotificationScope scope) {
            throw new AssertionError("El procesado no usa contadores para deduplicar");
        }

        @Override
        public Optional<Notification> markRead(NotificationScope scope, UUID notificationId, Instant readAt) {
            throw new AssertionError("El procesado no marca notificaciones leídas");
        }

        @Override
        public long markAllRead(NotificationScope scope, Instant readAt) {
            throw new AssertionError("El procesado no altera lecturas previas");
        }
    }
}
