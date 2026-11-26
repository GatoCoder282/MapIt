package com.mapit.operations.infrastructure.notification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.*;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
public class JdbcNotificationRepository implements NotificationRepository {
    private static final RowMapper<Notification> ROW = (r, index) -> notification(r);
    // Defensa SQL además del scope. Misma política vigente de canReadOperations/canCheckIn
    // de MAP-238 para los dos tipos operativos actuales; no concede acceso SUPER_ADMIN.
    private static final String ELIGIBLE = """
        and exists(select 1 from app_user u join tenant t on t.id=u.tenant_id
          join establishment e on e.tenant_id=u.tenant_id and e.id=n.establishment_id
          left join establishment_staff_access a on a.tenant_id=e.tenant_id
            and a.establishment_id=e.id and a.user_id=u.id
          where u.tenant_id=n.tenant_id and u.id=n.recipient_user_id and u.active
            and t.status='ACTIVE' and e.deleted_at is null
            and (u.role in ('ADMIN','MANAGER') or (u.role='STAFF' and a.can_check_in)))
        """;
    private final JdbcTemplate jdbc;
    private final NotificationAuthorizationPort authorization;
    private final Duration retention;

    public JdbcNotificationRepository(JdbcTemplate jdbc, NotificationAuthorizationPort authorization,
            @Value("${mapit.notifications.retention-days:30}") int retentionDays) {
        if (retentionDays < 1 || retentionDays > 3650) throw new IllegalArgumentException("Retención inválida");
        this.jdbc = jdbc;
        this.authorization = authorization;
        this.retention = Duration.ofDays(retentionDays);
    }

    @Override
    public Notification createIfAbsent(Notification value) {
        var allowed = authorization.resolve(value.recipient());
        if (allowed.isEmpty() || !allowed.orElseThrow().permits(value)) throw new SecurityException("Destinatario no autorizado");
        tenant(value.recipient().tenantId());
        if (!Boolean.TRUE.equals(jdbc.queryForObject("select cast(? as timestamptz)>statement_timestamp()",
                Boolean.class, Timestamp.from(value.createdAt().plus(retention))))) throw new NotificationExpiredException();
        String fingerprint = fingerprint(value.event());
        var recipient = value.recipient();
        var event = value.event();
        var colliding = jdbc.query("""
            select recipient_user_id,source_event_id,event_type from notification_delivery_key
            where tenant_id=? and notification_id=?
            """, (r, i) -> new NotificationKey(new NotificationRecipient(recipient.tenantId(),
                r.getObject("recipient_user_id", UUID.class)), r.getObject("source_event_id", UUID.class),
                NotificationType.valueOf(r.getString("event_type"))), recipient.tenantId().value(), value.id());
        if (!colliding.isEmpty() && !colliding.getFirst().equals(value.key())) throw new NotificationDeliveryConflictException();
        var inserted = jdbc.query("""
            insert into notification_delivery_key(tenant_id,recipient_user_id,source_event_id,event_type,event_fingerprint,notification_id)
            values (?,?,?,?,?,?) on conflict(tenant_id,recipient_user_id,source_event_id,event_type) do nothing returning id
            """, (r, i) -> r.getObject("id", UUID.class), recipient.tenantId().value(), recipient.userId(), event.id(), event.type().name(), fingerprint, value.id());
        var key = jdbc.queryForMap("""
            select id,notification_id,event_fingerprint from notification_delivery_key
            where tenant_id=? and recipient_user_id=? and source_event_id=? and event_type=? for update
            """, recipient.tenantId().value(), recipient.userId(), event.id(), event.type().name());
        if (!fingerprint.equals(key.get("event_fingerprint"))) throw new NotificationDeliveryConflictException();
        if (inserted.isEmpty()) {
            return jdbc.query("select n.* from notification n where n.tenant_id=? and n.delivery_key_id=? and n.expires_at>statement_timestamp()",
                    ROW, recipient.tenantId().value(), key.get("id")).stream().findFirst().orElseThrow(NotificationExpiredException::new);
        }
        return jdbc.query("""
            insert into notification(id,tenant_id,delivery_key_id,recipient_user_id,source_event_id,event_type,category,
              establishment_id,reservation_id,occurred_at,created_at,read_at,expires_at)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?) returning *
            """, ROW, value.id(), recipient.tenantId().value(), key.get("id"), recipient.userId(), event.id(),
                event.type().name(), value.category().name(), event.establishmentId(), event.reservationId(),
                Timestamp.from(event.occurredAt()), Timestamp.from(value.createdAt()),
                value.readAt() == null ? null : Timestamp.from(value.readAt()), Timestamp.from(value.createdAt().plus(retention))).getFirst();
    }

    @Override
    public NotificationPage list(NotificationPageRequest request) {
        var filter = filter(request.scope());
        String boundary = "";
        if (request.before() != null) {
            boundary = " and (n.created_at,n.id)<(?,?)";
            filter.args().add(Timestamp.from(request.before().createdAt()));
            filter.args().add(request.before().notificationId());
        }
        filter.args().add(request.limit()+1);
        var rows = jdbc.query("select n.* from notification n where "+filter.sql()+boundary+
                " order by n.created_at desc,n.id desc limit ?", ROW, filter.args().toArray());
        return new NotificationPage(request, rows.stream().limit(request.limit()).toList(), rows.size()>request.limit());
    }

    @Override
    public long countUnread(NotificationScope scope) {
        var filter = filter(scope);
        return jdbc.queryForObject("select count(*) from notification n where "+filter.sql()+" and n.read_at is null", Long.class, filter.args().toArray());
    }

    @Override
    public Optional<Notification> markRead(NotificationScope scope, UUID id, Instant at) {
        var filter = filter(scope);
        var args = new ArrayList<Object>();
        args.add(timestamp(at)); args.addAll(filter.args()); args.add(id); args.add(timestamp(at));
        return jdbc.query("update notification n set read_at=coalesce(n.read_at,?) where "+filter.sql()+
                " and n.id=? and (n.read_at is not null or n.created_at<=?) returning n.*", ROW, args.toArray()).stream().findFirst();
    }

    @Override
    public long markAllRead(NotificationScope scope, Instant at) {
        var filter = filter(scope);
        var args = new ArrayList<Object>();
        args.add(timestamp(at)); args.addAll(filter.args()); args.add(timestamp(at));
        return jdbc.update("update notification n set read_at=? where "+filter.sql()+
                " and n.read_at is null and n.created_at<=?", args.toArray());
    }

    /** Solo worker interno; no borra claves de deduplicación ni datos de otro dominio. */
    public int purgeExpired(TenantId tenant, int batch) {
        if (batch<1 || batch>1000) throw new IllegalArgumentException("Lote inválido");
        tenant(tenant);
        return jdbc.update("""
            delete from notification where tenant_id=? and id in
              (select id from notification where tenant_id=? and expires_at<=statement_timestamp()
               order by expires_at,id limit ? for update skip locked)
            """, tenant.value(), tenant.value(), batch);
    }

    private Filter filter(NotificationScope scope) {
        tenant(scope.recipient().tenantId());
        var args = new ArrayList<Object>();
        args.add(scope.recipient().tenantId().value()); args.add(scope.recipient().userId());
        var types = new ArrayList<String>();
        for (var type : NotificationType.values()) {
            var ids = scope.establishmentsByType().getOrDefault(type, java.util.Set.of()).stream().sorted().toList();
            if (ids.isEmpty()) continue;
            types.add("(n.event_type=? and n.establishment_id in ("+String.join(",", java.util.Collections.nCopies(ids.size(), "?"))+"))");
            args.add(type.name()); args.addAll(ids);
        }
        return new Filter("n.tenant_id=? and n.recipient_user_id=? and n.expires_at>statement_timestamp() and ("+
                (types.isEmpty() ? "false" : String.join(" or ", types))+") "+ELIGIBLE, args);
    }
    private record Filter(String sql, List<Object> args) {}
    private void tenant(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }
    private static Timestamp timestamp(Instant value) { return Timestamp.from(value.truncatedTo(java.time.temporal.ChronoUnit.MICROS)); }
    private static Notification notification(ResultSet r) throws SQLException {
        var tenant = TenantId.of(r.getString("tenant_id"));
        var read = r.getTimestamp("read_at");
        return new Notification(r.getObject("id", UUID.class), new NotificationRecipient(tenant,r.getObject("recipient_user_id", UUID.class)),
                new NotificationEvent(r.getObject("source_event_id", UUID.class), tenant, NotificationType.valueOf(r.getString("event_type")),
                    r.getTimestamp("occurred_at").toInstant(), r.getObject("establishment_id", UUID.class), r.getObject("reservation_id", UUID.class)),
                r.getTimestamp("created_at").toInstant(), read == null ? null : read.toInstant());
    }
    private static String fingerprint(NotificationEvent event) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(event.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException("SHA-256 no disponible"); }
    }
}
