package com.mapit.operations.application.notification;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationRecipientCandidatesPort;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.shared.security.EstablishmentAuthorizationPort;

/** Selección interna con permisos vigentes; no interpreta destinatarios de payloads externos. */
public class ResolveNotificationRecipients {
    private final NotificationRecipientCandidatesPort candidates;
    private final NotificationAuthorizationPort authorization;
    private final EstablishmentAuthorizationPort establishments;

    public ResolveNotificationRecipients(
            NotificationRecipientCandidatesPort candidates,
            NotificationAuthorizationPort authorization,
            EstablishmentAuthorizationPort establishments) {
        this.candidates = Objects.requireNonNull(candidates);
        this.authorization = Objects.requireNonNull(authorization);
        this.establishments = Objects.requireNonNull(establishments);
    }

    @Transactional(readOnly = true)
    public Set<NotificationRecipient> execute(NotificationEvent event) {
        Objects.requireNonNull(event, "event no puede ser null");
        Set<NotificationRecipient> unique = new LinkedHashSet<>(List.copyOf(candidates.findCandidates(event)));
        Set<NotificationRecipient> resolved = new LinkedHashSet<>();
        for (NotificationRecipient candidate : unique) {
            if (!event.tenantId().equals(candidate.tenantId())) continue;
            var authorized = authorization.resolve(candidate);
            if (authorized.isEmpty()) continue;
            NotificationScope scope = authorized.orElseThrow();
            if (!candidate.equals(scope.recipient())) throw new NotificationAccessDeniedException();
            if (!scope.establishmentsByType().getOrDefault(event.type(), Set.of())
                    .contains(event.establishmentId())) continue;
            boolean allowed = switch (event.type()) {
                case RESERVATION_CREATED -> establishments.canReadOperations(
                        event.tenantId(), candidate.userId(), event.establishmentId());
                case RESERVATION_CHECKED_IN -> establishments.canCheckIn(
                        event.tenantId(), candidate.userId(), event.establishmentId());
            };
            if (allowed) resolved.add(candidate);
        }
        return Set.copyOf(resolved);
    }
}
