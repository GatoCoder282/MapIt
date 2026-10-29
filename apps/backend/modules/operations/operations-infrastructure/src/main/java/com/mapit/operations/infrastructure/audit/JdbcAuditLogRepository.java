package com.mapit.operations.infrastructure.audit;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.operations.domain.audit.AuditLog;
import com.mapit.operations.domain.audit.AuditLogFilter;
import com.mapit.operations.domain.audit.AuditLogPage;
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

  @Override
  public AuditLogPage search(TenantId tenantId, AuditLogFilter filter, int page, int size) {
    requireTransaction();
    setTenant(tenantId);
    QueryParts query = queryParts(tenantId, filter);
    long totalElements =
        jdbc.queryForObject(
            "select count(*) from audit_log " + query.whereClause(),
            Long.class,
            query.arguments().toArray());

    List<Object> pageArguments = new ArrayList<>(query.arguments());
    pageArguments.add(size);
    pageArguments.add((long) page * size);
    List<AuditLog> content =
        jdbc.query(
            """
            select id, tenant_id, actor_id, occurred_at, resource_type,
                   resource_id, event_type, details::text as details
            from audit_log
            """
                + query.whereClause()
                + " order by occurred_at desc, id desc limit ? offset ?",
            (rs, rowNumber) -> map(rs),
            pageArguments.toArray());

    int totalPages = Math.toIntExact(Math.ceilDiv(totalElements, (long) size));
    return new AuditLogPage(content, page, size, totalElements, totalPages);
  }

  private QueryParts queryParts(TenantId tenantId, AuditLogFilter filter) {
    StringBuilder where = new StringBuilder("where tenant_id = ?");
    List<Object> arguments = new ArrayList<>();
    arguments.add(tenantId.value());
    if (filter.resourceType() != null) {
      where.append(" and resource_type = ?");
      arguments.add(filter.resourceType().name());
    }
    if (filter.eventType() != null) {
      where.append(" and event_type = ?");
      arguments.add(filter.eventType().name());
    }
    if (filter.resourceId() != null) {
      where.append(" and resource_id = ?");
      arguments.add(filter.resourceId());
    }
    if (filter.from() != null) {
      where.append(" and occurred_at >= ?");
      arguments.add(Timestamp.from(filter.from()));
    }
    if (filter.to() != null) {
      where.append(" and occurred_at <= ?");
      arguments.add(Timestamp.from(filter.to()));
    }
    return new QueryParts(where.toString(), List.copyOf(arguments));
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

  private record QueryParts(String whereClause, List<Object> arguments) {}
}
