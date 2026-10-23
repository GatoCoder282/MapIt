package com.mapit.operations.infrastructure.audit;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.operations.domain.audit.AuditLog;
import com.mapit.operations.domain.audit.AuditLogRepository;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** Adaptador JDBC único para escritura transversal y consulta de la bitácora. */
@Repository
public class JdbcAuditLogRepository implements AuditLogRepository, AuditEventRecorder {

  private static final TypeReference<Map<String, String>> DETAILS_TYPE = new TypeReference<>() {};

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public JdbcAuditLogRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  @Override
  public void record(AuditEvent event) {
    append(AuditLog.from(event));
  }

  @Override
  public void append(AuditLog auditLog) {
    requireTransaction();
    setTenant(auditLog.tenantId());
    jdbc.update(
        """
        insert into audit_log
          (id, tenant_id, actor_id, occurred_at, resource_type, resource_id, event_type, details)
        values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
        """,
        auditLog.id(),
        auditLog.tenantId().value(),
        auditLog.actorId(),
        Timestamp.from(auditLog.occurredAt()),
        auditLog.resourceType().name(),
        auditLog.resourceId(),
        auditLog.eventType().name(),
        writeDetails(auditLog.details()));
  }

  @Override
  public Optional<AuditLog> findById(TenantId tenantId, UUID id) {
    requireTransaction();
    setTenant(tenantId);
    List<AuditLog> matches =
        jdbc.query(
            """
            select id, tenant_id, actor_id, occurred_at, resource_type,
                   resource_id, event_type, details::text as details
            from audit_log
            where tenant_id = ? and id = ?
            """,
            (rs, rowNumber) -> map(rs),
            tenantId.value(),
            id);
    return matches.stream().findFirst();
  }

  private AuditLog map(ResultSet rs) throws SQLException {
    return new AuditLog(
        rs.getObject("id", UUID.class),
        TenantId.of(rs.getString("tenant_id")),
        rs.getObject("actor_id", UUID.class),
        rs.getTimestamp("occurred_at").toInstant(),
        AuditResourceType.valueOf(rs.getString("resource_type")),
        rs.getObject("resource_id", UUID.class),
        AuditEventType.valueOf(rs.getString("event_type")),
        readDetails(rs.getString("details")));
  }

  private String writeDetails(Map<String, String> details) {
    try {
      return objectMapper.writeValueAsString(details);
    } catch (RuntimeException exception) {
      throw new IllegalStateException("No se pudieron serializar los detalles de auditoría", exception);
    }
  }

  private Map<String, String> readDetails(String details) {
    try {
      return objectMapper.readValue(details, DETAILS_TYPE);
    } catch (RuntimeException exception) {
      throw new IllegalStateException("No se pudieron leer los detalles de auditoría", exception);
    }
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }

  private void requireTransaction() {
    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
      throw new IllegalStateException("La auditoría requiere una transacción activa");
    }
  }
}
