package com.mapit.operations.infrastructure.notification;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.shared.tenant.TenantId;

/** Purga opt-in, acotada y ajena al flag. Nunca modifica claves ni otras tablas de negocio. */
@Component
@ConditionalOnProperty(name="mapit.notifications.cleanup-enabled", havingValue="true")
public class NotificationRetentionJob {
    private final JdbcTemplate jdbc;
    private final JdbcNotificationRepository notifications;
    private final TransactionTemplate transactions;
    public NotificationRetentionJob(JdbcTemplate jdbc, JdbcNotificationRepository notifications, TransactionTemplate transactions) {
        this.jdbc=jdbc; this.notifications=notifications; this.transactions=transactions;
    }
    @Scheduled(fixedDelayString="${mapit.notifications.cleanup-interval-ms:3600000}")
    public void purge() {
        for (String tenant : jdbc.queryForList("select id from tenant order by id", String.class)) {
            transactions.executeWithoutResult(status -> notifications.purgeExpired(TenantId.of(tenant),1000));
        }
    }
}
