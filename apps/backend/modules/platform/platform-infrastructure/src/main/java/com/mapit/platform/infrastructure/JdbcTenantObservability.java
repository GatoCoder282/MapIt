package com.mapit.platform.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.platform.domain.TenantStatus;
import com.mapit.platform.domain.observability.PlatformAccessLog;
import com.mapit.platform.domain.observability.TenantDirectory;
import com.mapit.platform.domain.observability.TenantMetricsReader;
import com.mapit.platform.domain.observability.TenantUsage;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/**
 * Proyecciones agregadas. Cada empresa se lee en una transacción propia con su contexto RLS:
 * no hay ningún bypass del aislamiento, y las consultas además filtran por {@code tenant_id}.
 */
@Repository
class JdbcTenantObservability implements TenantMetricsReader, TenantDirectory, PlatformAccessLog {

  /** Entregas reintentadas sin éxito a partir de las cuales se considera falla técnica. */
  private static final int FAILING_ATTEMPTS = 3;

  private static final Logger LOG = LoggerFactory.getLogger(JdbcTenantObservability.class);

  private final JdbcTemplate jdbc;
  private final TransactionTemplate isolated;

  JdbcTenantObservability(JdbcTemplate jdbc, PlatformTransactionManager transactions) {
    this.jdbc = jdbc;
    this.isolated = new TransactionTemplate(transactions);
    this.isolated.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  @Override
  public TenantUsage read(TenantId tenantId, Instant since) {
    try {
      return aggregate(tenantId, since);
    } catch (RuntimeException failure) {
      LOG.warn("No se pudieron leer los agregados de un tenant", failure);
      throw failure;
    }
  }

  private TenantUsage aggregate(TenantId tenantId, Instant since) {
    return isolated.execute(
        status -> {
          jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
          String tenant = tenantId.value();
          Map<String, Long> byVertical =
              counts(
                  "select type, count(*) from establishment where tenant_id = ? and deleted_at is null group by type order by type",
                  tenant);
          Map<String, Long> byStatus =
              counts(
                  "select status, count(*) from reservation where tenant_id = ? and created_at >= ? group by status",
                  tenant,
                  Timestamp.from(since));
          Map<LocalDate, Long> byDay = new LinkedHashMap<>();
          counts(
                  "select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD'), count(*) from reservation where tenant_id = ? and created_at >= ? group by 1",
                  tenant,
                  Timestamp.from(since))
              .forEach((day, count) -> byDay.put(LocalDate.parse(day), count));
          String lastDay =
              jdbc.queryForObject(
                  "select to_char(max(created_at) at time zone 'UTC', 'YYYY-MM-DD') from reservation where tenant_id = ?",
                  String.class,
                  tenant);
          long pending =
              count(
                  "select count(*) from realtime_event_outbox where tenant_id = ? and published_at is null",
                  tenant);
          long failing =
              count(
                  "select count(*) from realtime_event_outbox where tenant_id = ? and published_at is null and attempts >= "
                      + FAILING_ATTEMPTS,
                  tenant);
          boolean payments =
              count("select count(*) from merchant_payment_method where tenant_id = ? and enabled", tenant) > 0;
          return new TenantUsage(
              byVertical,
              byStatus,
              byDay,
              lastDay == null ? null : LocalDate.parse(lastDay),
              pending,
              failing,
              payments);
        });
  }

  @Override
  public TenantDirectory.Page search(
      @Nullable String text, @Nullable TenantStatus status, int page, int size) {
    List<Object> arguments = new ArrayList<>();
    StringBuilder where = new StringBuilder(" from tenant where id <> 'platform'");
    if (text != null && !text.isBlank()) {
      where.append(" and (lower(name) like ? or lower(slug) like ?)");
      String pattern = "%" + text.strip().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      arguments.add(pattern);
      arguments.add(pattern);
    }
    if (status != null) {
      where.append(" and status = ?");
      arguments.add(status.name());
    }
    Long total = jdbc.queryForObject("select count(*)" + where, Long.class, arguments.toArray());
    arguments.add(size);
    arguments.add((long) page * size);
    List<Entry> content =
        jdbc.query(
            "select id, slug, name, status" + where + " order by name, id limit ? offset ?",
            (row, index) -> entry(row),
            arguments.toArray());
    return new TenantDirectory.Page(content, total == null ? 0 : total);
  }

  @Override
  public List<Entry> all() {
    return jdbc.query(
        "select id, slug, name, status from tenant where id <> 'platform' order by id",
        (row, index) -> entry(row));
  }

  @Override
  public Optional<Entry> findBySlug(String slug) {
    return jdbc
        .query(
            "select id, slug, name, status from tenant where id <> 'platform' and slug = ?",
            (row, index) -> entry(row),
            slug)
        .stream()
        .findFirst();
  }

  @Override
  public void record(UUID actorId, View view, @Nullable String subjectTenantId) {
    isolated.executeWithoutResult(
        status -> {
          jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "platform");
          jdbc.update(
              "insert into platform_access_log (tenant_id, actor_id, view, subject_tenant_id) values ('platform', ?, ?, ?)",
              actorId,
              view.name(),
              subjectTenantId);
        });
  }

  private static Entry entry(ResultSet row) throws SQLException {
    return new Entry(
        row.getString("id"),
        row.getString("slug"),
        row.getString("name"),
        TenantStatus.valueOf(row.getString("status")));
  }

  private Map<String, Long> counts(String sql, Object... arguments) {
    Map<String, Long> counts = new LinkedHashMap<>();
    jdbc.query(sql, row -> { counts.put(row.getString(1), row.getLong(2)); }, arguments);
    return counts;
  }

  private long count(String sql, Object argument) {
    Long result = jdbc.queryForObject(sql, Long.class, argument);
    return result == null ? 0 : result;
  }
}
