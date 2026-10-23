package com.mapit.operations.infrastructure.realtime;

import java.sql.Timestamp;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;

import tools.jackson.databind.ObjectMapper;

/** Adaptador síncrono bus-local → outbox PostgreSQL. */
@Component
public final class JdbcRealtimeEventPublisher implements RealtimeEventPublisher {

  private static final Logger LOG = LoggerFactory.getLogger(JdbcRealtimeEventPublisher.class);

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public JdbcRealtimeEventPublisher(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  @Override
  public void publish(RealtimeEvent event) {
    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
      throw new IllegalStateException(
          "RealtimeEventPublisher.publish requiere la transacción del caso de uso");
    }
    final String payload;
    try {
      payload = objectMapper.writeValueAsString(RealtimeWireEnvelope.from(event));
    } catch (RuntimeException exception) {
      throw new IllegalStateException("No se pudo serializar el evento de tiempo real", exception);
    }
    jdbc.update(
        """
        insert into realtime_event_outbox
          (event_id, tenant_id, event_type, schema_version, occurred_at,
           establishment_id, sector_id, aggregate_version, payload)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
        """,
        event.eventId(),
        event.tenantId().value(),
        event.eventType(),
        event.schemaVersion(),
        Timestamp.from(event.occurredAt()),
        event.establishmentId(),
        event.sectorId().orElse(null),
        event.aggregateVersion(),
        payload);
    Map<String, String> origin = MDC.getCopyOfContextMap();
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            try {
              MDC.clear();
              if (origin != null && origin.containsKey("request_id")) {
                MDC.put("request_id", origin.get("request_id"));
              }
              MDC.put("tenant_id", event.tenantId().value());
              MDC.put("event_id", event.eventId().toString());
              LOG.atInfo().addKeyValue("event", "outbox.enqueued").log("Realtime event committed");
            } finally {
              MDC.clear();
              if (previous != null) MDC.setContextMap(previous);
            }
          }
        });
  }
}
