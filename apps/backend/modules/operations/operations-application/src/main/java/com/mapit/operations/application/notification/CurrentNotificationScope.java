package com.mapit.operations.application.notification;

import java.util.Objects;

import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;

/** Resuelve identidad y concesiones en cada operación; nunca acepta identidad del comando. */
public final class CurrentNotificationScope {
    private final ActorContext actors;
    private final TenantContext tenants;
    private final NotificationAuthorizationPort authorization;

    public CurrentNotificationScope(
            ActorContext actors, TenantContext tenants, NotificationAuthorizationPort authorization) {
        this.actors = Objects.requireNonNull(actors);
        this.tenants = Objects.requireNonNull(tenants);
        this.authorization = Objects.requireNonNull(authorization);
    }

    public NotificationScope require() {
        var user = actors.currentUserId().orElseThrow(NotificationAuthenticationRequiredException::new);
        var tenant = tenants.current().orElseThrow(NotificationAuthenticationRequiredException::new);
        NotificationRecipient authenticated = new NotificationRecipient(tenant, user);
        NotificationScope scope = authorization.resolve(authenticated)
                .orElseThrow(NotificationAccessDeniedException::new);
        if (!authenticated.equals(scope.recipient())) {
            throw new NotificationAccessDeniedException();
        }
        return scope;
    }
}
