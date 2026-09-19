package com.mapit.operations.infrastructure.realtime;

import java.sql.Timestamp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;

import tools.jackson.databind.ObjectMapper;

/** Adaptador síncrono bus-local → outbox PostgreSQL. */
@Component
public final class JdbcRealtimeEventPublisher implements RealtimeEventPublisher {

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
  }
}
