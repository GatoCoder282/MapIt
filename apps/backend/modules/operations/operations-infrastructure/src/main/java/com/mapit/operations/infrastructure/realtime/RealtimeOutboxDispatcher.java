package com.mapit.operations.infrastructure.realtime;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeDestination;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/**
 * Dispatcher del outbox al simple broker de Spring.
 *
 * <p>La consulta y el claim se ejecutan con el tenant fijado en la misma transacción. El envío se
 * marca después de publicar; una caída en medio puede producir un duplicado, nunca una pérdida.
 */
@Component
public final class RealtimeOutboxDispatcher {

  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final SimpMessagingTemplate broker;
  private final FeatureFlagPort flags;
  private final Clock clock;
  private final int batchSize;
  private final Duration retention;

  public RealtimeOutboxDispatcher(
      JdbcTemplate jdbc,
      TransactionTemplate transactions,
      SimpMessagingTemplate broker,
      FeatureFlagPort flags,
      Clock clock,
      @Value("${mapit.realtime.outbox.batch-size:50}") int batchSize,
      @Value("${mapit.realtime.outbox.retention-days:7}") int retentionDays) {
    if (batchSize < 1) throw new IllegalArgumentException("batch-size debe ser positivo");
    if (retentionDays < 1) throw new IllegalArgumentException("retention-days debe ser positivo");
    this.jdbc = jdbc;
    this.transactions = transactions;
    this.broker = broker;
    this.flags = flags;
    this.clock = clock;
    this.batchSize = batchSize;
    this.retention = Duration.ofDays(retentionDays);
  }

  @Scheduled(fixedDelayString = "${mapit.realtime.outbox.poll-interval-ms:250}")
  public void dispatchPending() {
    // El kill switch se evalúa antes de reclamar: apagarlo no deja filas en vuelo nuevas.
    if (!flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)) return;
    for (String tenant : tenants()) {
      transactions.executeWithoutResult(
          status -> dispatchTenant(TenantId.of(tenant)));
    }
  }

  @Scheduled(fixedDelayString = "${mapit.realtime.outbox.cleanup-interval-ms:3600000}")
  public void cleanPublished() {
    Instant before = clock.instant().minus(retention);
    for (String tenant : tenants()) {
      transactions.executeWithoutResult(
          status -> {
            TenantId tenantId = TenantId.of(tenant);
            setTenant(tenantId);
            jdbc.update(
                "delete from realtime_event_outbox where tenant_id = ? and published_at < ?",
                tenantId.value(),
                Timestamp.from(before));
          });
    }
  }

  private List<String> tenants() {
    return jdbc.queryForList(
        "select id from tenant where status = 'ACTIVE' order by id", String.class);
  }

  private void dispatchTenant(TenantId tenantId) {
    setTenant(tenantId);
    List<OutboxRow> rows =
        jdbc.query(
            """
            select event_id, establishment_id, sector_id, payload, attempts
            from realtime_event_outbox
            where tenant_id = ?
              and published_at is null
              and available_at <= now()
              and (claimed_at is null or claimed_at < now() - interval '30 seconds')
            order by occurred_at, event_id
            limit ?
            for update skip locked
            """,
            (rs, rowNum) ->
                new OutboxRow(
                    rs.getObject("event_id", UUID.class),
                    rs.getObject("establishment_id", UUID.class),
                    rs.getObject("sector_id", UUID.class),
                    rs.getString("payload"),
                    rs.getInt("attempts")),
            tenantId.value(),
            batchSize);

    for (OutboxRow row : rows) {
      jdbc.update(
          "update realtime_event_outbox set claimed_at = now(), attempts = attempts + 1 where event_id = ?",
          row.eventId());
      try {
        broker.convertAndSend(
            new RealtimeDestination(row.establishmentId(), java.util.Optional.empty()).topic(),
            row.payload());
        if (row.sectorId() != null) {
          broker.convertAndSend(
              new RealtimeDestination(row.establishmentId(), java.util.Optional.of(row.sectorId()))
                  .topic(),
              row.payload());
        }
        jdbc.update(
            "update realtime_event_outbox set published_at = ?, claimed_at = null, last_error = null where event_id = ? and published_at is null",
            Timestamp.from(clock.instant()),
            row.eventId());
      } catch (RuntimeException exception) {
        Instant nextAttempt = clock.instant().plusMillis(retryDelayMillis(row.attempts() + 1));
        jdbc.update(
            "update realtime_event_outbox set available_at = ?, claimed_at = null, last_error = ? where event_id = ?",
            Timestamp.from(nextAttempt),
            exception.getMessage(),
            row.eventId());
      }
    }
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }

  private static long retryDelayMillis(int attempt) {
    long delay = 250L;
    for (int i = 1; i < attempt && delay < 30_000L; i++) {
      delay = Math.min(delay * 2, 30_000L);
    }
    return delay;
  }

  private record OutboxRow(
      UUID eventId, UUID establishmentId, UUID sectorId, String payload, int attempts) {}
}
