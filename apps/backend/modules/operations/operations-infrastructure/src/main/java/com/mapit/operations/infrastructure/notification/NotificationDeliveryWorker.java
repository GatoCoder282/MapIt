package com.mapit.operations.infrastructure.notification;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.operations.application.notification.ProcessNotificationEvent;
import com.mapit.operations.domain.notification.*;
import com.mapit.shared.tenant.*;

/** Dos fases durables: fanout confirmado y señales de versiones ya confirmadas. */
@Component
public class NotificationDeliveryWorker {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ProcessNotificationEvent process;
    private final NotificationInvalidationPublisher signals;
    private final NotificationAuthorizationPort authorization;
    private final Clock clock;
    public NotificationDeliveryWorker(JdbcTemplate jdbc,TransactionTemplate transactions,ProcessNotificationEvent process,
            NotificationInvalidationPublisher signals,NotificationAuthorizationPort authorization,Clock clock) {
        this.jdbc=jdbc;this.transactions=transactions;this.process=process;this.signals=signals;this.authorization=authorization;this.clock=clock;
    }
    @Scheduled(fixedDelayString="${mapit.notifications.delivery-interval-ms:1000}")
    public void deliver() {
        for(String tenant:jdbc.queryForList("select id from tenant where status='ACTIVE' order by id",String.class)) {
            try {
                transactions.executeWithoutResult(s->fanout(TenantId.of(tenant)));
                transactions.executeWithoutResult(s->signal(TenantId.of(tenant)));
            } catch(RuntimeException retry) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("notification.delivery.retry");
            }
        }
    }
    @org.springframework.transaction.annotation.Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void fanout(TenantId tenant) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,tenant.value());
        var events=jdbc.query("select * from notification_event_outbox where tenant_id=? and processed_at is null order by created_at,id limit 50 for update skip locked",
            (r,i)->new NotificationEvent(r.getObject("id",UUID.class),tenant,NotificationType.valueOf(r.getString("event_type")),r.getTimestamp("occurred_at").toInstant(),r.getObject("establishment_id",UUID.class),r.getObject("reservation_id",UUID.class)),tenant.value());
        for(var event:events) {
            process.execute(event);
            jdbc.update("update notification_event_outbox set processed_at=statement_timestamp() where tenant_id=? and id=?",tenant.value(),event.id());
        }
    }
    @org.springframework.transaction.annotation.Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void signal(TenantId tenant) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,tenant.value());
        var rows=jdbc.queryForList("select id,recipient_user_id,signal_version,event_type,establishment_id from notification where tenant_id=? and signal_version>delivered_version and expires_at>statement_timestamp() order by id limit 100 for update skip locked",tenant.value());
        for(var row:rows) {
            var recipient=new NotificationRecipient(tenant,(UUID)row.get("recipient_user_id"));
            var scope=authorization.resolve(recipient);
            var type=NotificationType.valueOf((String)row.get("event_type"));
            if(scope.isEmpty() || !scope.orElseThrow().establishmentsByType().getOrDefault(type,java.util.Set.of()).contains(row.get("establishment_id"))) continue;
            UUID signalId=UUID.nameUUIDFromBytes((row.get("id")+":"+row.get("signal_version")).getBytes(StandardCharsets.UTF_8));
            signals.publish(new NotificationInvalidation(signalId,recipient,clock.instant()));
            jdbc.update("update notification set delivered_version=? where tenant_id=? and id=?",row.get("signal_version"),tenant.value(),row.get("id"));
        }
    }
}
