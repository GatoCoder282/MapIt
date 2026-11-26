package com.mapit.operations.infrastructure.notification;

import java.util.EnumMap;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.*;
import com.mapit.shared.tenant.TenantScope;

@Repository
@Transactional(propagation=Propagation.MANDATORY)
public class JdbcNotificationPreferences implements NotificationPreferencesPort {
    private final JdbcTemplate jdbc;
    public JdbcNotificationPreferences(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Map<NotificationCategory,Boolean> read(NotificationRecipient recipient) {
        tenant(recipient);
        var result=new EnumMap<NotificationCategory,Boolean>(NotificationCategory.class);
        result.put(NotificationCategory.RESERVATIONS,true); result.put(NotificationCategory.OPERATIONS,true);
        jdbc.query("select category,enabled from notification_preference where tenant_id=? and user_id=?",
                (org.springframework.jdbc.core.RowCallbackHandler) r->result.put(NotificationCategory.valueOf(r.getString(1)),r.getBoolean(2)),recipient.tenantId().value(),recipient.userId());
        return Map.copyOf(result);
    }
    public Map<NotificationCategory,Boolean> patch(NotificationRecipient recipient, Map<NotificationCategory,Boolean> changes) {
        if(changes.isEmpty() || changes.entrySet().stream().anyMatch(e->e.getKey()==null || e.getValue()==null)) throw new IllegalArgumentException("Preferencias inválidas");
        tenant(recipient);
        for(var change:changes.entrySet()) jdbc.update("""
            insert into notification_preference(tenant_id,user_id,category,enabled) values(?,?,?,?)
            on conflict(tenant_id,user_id,category) do update set enabled=excluded.enabled
            """,recipient.tenantId().value(),recipient.userId(),change.getKey().name(),change.getValue());
        return read(recipient);
    }
    private void tenant(NotificationRecipient recipient) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,recipient.tenantId().value()); }
}
