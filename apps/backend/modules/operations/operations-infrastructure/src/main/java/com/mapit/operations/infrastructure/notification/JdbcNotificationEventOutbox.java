package com.mapit.operations.infrastructure.notification;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.*;
import com.mapit.shared.notification.ReservationNotificationEvents;
import com.mapit.shared.tenant.*;

/** Captura atómica de hechos y candidatos originales, independiente de flags y published_at. */
@Repository
@Transactional(propagation=Propagation.MANDATORY)
public class JdbcNotificationEventOutbox implements ReservationNotificationEvents, NotificationRecipientCandidatesPort {
    private final JdbcTemplate jdbc;
    public JdbcNotificationEventOutbox(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public void record(UUID id,TenantId tenant,String type,Instant at,UUID establishment,UUID reservation) {
        var event=new NotificationEvent(id,tenant,NotificationType.valueOf(type),at,establishment,reservation);
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,tenant.value());
        int inserted=jdbc.update("""
            insert into notification_event_outbox(id,tenant_id,event_type,occurred_at,establishment_id,reservation_id)
            values(?,?,?,?,?,?) on conflict(tenant_id,id) do nothing
            """,id,tenant.value(),type,Timestamp.from(event.occurredAt()),establishment,reservation);
        var original=jdbc.queryForMap("select event_type,occurred_at,establishment_id,reservation_id from notification_event_outbox where tenant_id=? and id=?",tenant.value(),id);
        if(!type.equals(original.get("event_type")) || !event.occurredAt().equals(((Timestamp)original.get("occurred_at")).toInstant().truncatedTo(ChronoUnit.MICROS))
                || !establishment.equals(original.get("establishment_id")) || !reservation.equals(original.get("reservation_id"))) throw new NotificationDeliveryConflictException();
        if(inserted==0) return;
        jdbc.update("""
            insert into notification_event_candidate(tenant_id,event_id,user_id)
            select u.tenant_id,?,u.id from app_user u join tenant t on t.id=u.tenant_id
            join establishment e on e.tenant_id=u.tenant_id and e.id=?
            left join establishment_staff_access a on a.tenant_id=u.tenant_id and a.establishment_id=e.id and a.user_id=u.id
            where u.tenant_id=? and u.active and t.status='ACTIVE' and e.deleted_at is null
            and (u.role in ('ADMIN','MANAGER') or (u.role='STAFF' and a.can_check_in))
            """,id,establishment,tenant.value());
    }
    public List<NotificationRecipient> findCandidates(NotificationEvent event) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,event.tenantId().value());
        return jdbc.query("select user_id from notification_event_candidate where tenant_id=? and event_id=? order by user_id",
            (r,i)->new NotificationRecipient(event.tenantId(),r.getObject(1,UUID.class)),event.tenantId().value(),event.id());
    }
}
