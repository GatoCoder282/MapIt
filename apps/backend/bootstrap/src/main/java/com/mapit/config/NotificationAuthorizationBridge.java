package com.mapit.config;

import java.util.EnumMap;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.TenantUserRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.operations.domain.notification.*;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository;

/** Adaptador entre módulos, sin suplantar JWT ni inventar permisos para destinatarios internos. */
@Component
public class NotificationAuthorizationBridge implements NotificationAuthorizationPort {
    private final TenantUserRepository users;
    private final EstablishmentAccessRepository establishments;
    private final EstablishmentAuthorizationPort authorization;
    public NotificationAuthorizationBridge(TenantUserRepository users, EstablishmentAccessRepository establishments,
            EstablishmentAuthorizationPort authorization) {
        this.users=users; this.establishments=establishments; this.authorization=authorization;
    }
    @Override @Transactional(readOnly=true)
    public Optional<NotificationScope> resolve(NotificationRecipient recipient) {
        var tenant = recipient.tenantId();
        if (!users.tenantActive(tenant)) return Optional.empty();
        var user = users.findById(tenant,recipient.userId());
        if (user.isEmpty() || !user.orElseThrow().active()) return Optional.empty();
        if ((user.orElseThrow().role()==UserRole.SUPER_ADMIN) != tenant.value().equals("platform")) return Optional.empty();
        var grants = new EnumMap<NotificationType,Set<UUID>>(NotificationType.class);
        var reservations = new HashSet<UUID>(); var arrivals = new HashSet<UUID>();
        for (var establishment : establishments.accessible(tenant,recipient.userId())) {
            if (authorization.canReadOperations(tenant,recipient.userId(),establishment.id())) reservations.add(establishment.id());
            if (authorization.canCheckIn(tenant,recipient.userId(),establishment.id())) arrivals.add(establishment.id());
        }
        grants.put(NotificationType.RESERVATION_CREATED,reservations);
        grants.put(NotificationType.RESERVATION_CHECKED_IN,arrivals);
        return Optional.of(new NotificationScope(recipient,grants));
    }
}
