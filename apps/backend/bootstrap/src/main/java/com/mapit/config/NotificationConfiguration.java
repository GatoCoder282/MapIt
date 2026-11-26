package com.mapit.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.operations.application.notification.*;
import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;

/** Centro durable: consultas, preferencias, resolución y publicación privada posterior al commit. */
@Configuration
public class NotificationConfiguration {
    @Bean MyNotificationPreferences myNotificationPreferences(CurrentNotificationScope scope, com.mapit.operations.domain.notification.NotificationPreferencesPort preferences) { return new MyNotificationPreferences(scope,preferences); }
    @Bean ResolveNotificationRecipients notificationRecipients(com.mapit.operations.domain.notification.NotificationRecipientCandidatesPort candidates,
            NotificationAuthorizationPort authorization, com.mapit.shared.security.EstablishmentAuthorizationPort establishments) {
        return new ResolveNotificationRecipients(candidates,authorization,establishments);
    }
    @Bean ProcessNotificationEvent processNotificationEvent(ResolveNotificationRecipients recipients, NotificationRepository repository,Clock clock,
            com.mapit.operations.domain.notification.NotificationPreferencesPort preferences) {
        return new ProcessNotificationEvent(recipients,repository,clock,(recipient,category)->preferences.read(recipient).getOrDefault(category,true));
    }
    @Bean com.mapit.operations.domain.notification.NotificationInvalidationPublisher notificationSignals(org.springframework.messaging.simp.SimpMessagingTemplate broker) {
        return new com.mapit.operations.infrastructure.realtime.StompNotificationInvalidationPublisher(broker);
    }

    @Bean CurrentNotificationScope notificationScope(ActorContext actors, TenantContext tenants, NotificationAuthorizationPort authorization) {
        return new CurrentNotificationScope(actors,tenants,authorization);
    }
    @Bean ListMyNotifications listMyNotifications(NotificationRepository repository, CurrentNotificationScope scope) { return new ListMyNotifications(repository,scope); }
    @Bean CountMyUnreadNotifications countMyUnreadNotifications(NotificationRepository repository, CurrentNotificationScope scope) { return new CountMyUnreadNotifications(repository,scope); }
    @Bean MarkMyNotificationRead markMyNotificationRead(NotificationRepository repository, CurrentNotificationScope scope, Clock clock) { return new MarkMyNotificationRead(repository,scope,clock); }
    @Bean MarkAllMyNotificationsRead markAllMyNotificationsRead(NotificationRepository repository, CurrentNotificationScope scope, Clock clock) { return new MarkAllMyNotificationsRead(repository,scope,clock); }
}
