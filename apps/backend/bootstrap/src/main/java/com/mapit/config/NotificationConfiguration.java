package com.mapit.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.operations.application.notification.*;
import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;

/** Solo consultas/marcado. Productores y STOMP no se activan mediante este wiring. */
@Configuration
public class NotificationConfiguration {
    @Bean CurrentNotificationScope notificationScope(ActorContext actors, TenantContext tenants, NotificationAuthorizationPort authorization) {
        return new CurrentNotificationScope(actors,tenants,authorization);
    }
    @Bean ListMyNotifications listMyNotifications(NotificationRepository repository, CurrentNotificationScope scope) { return new ListMyNotifications(repository,scope); }
    @Bean CountMyUnreadNotifications countMyUnreadNotifications(NotificationRepository repository, CurrentNotificationScope scope) { return new CountMyUnreadNotifications(repository,scope); }
    @Bean MarkMyNotificationRead markMyNotificationRead(NotificationRepository repository, CurrentNotificationScope scope, Clock clock) { return new MarkMyNotificationRead(repository,scope,clock); }
    @Bean MarkAllMyNotificationsRead markAllMyNotificationsRead(NotificationRepository repository, CurrentNotificationScope scope, Clock clock) { return new MarkAllMyNotificationsRead(repository,scope,clock); }
}
