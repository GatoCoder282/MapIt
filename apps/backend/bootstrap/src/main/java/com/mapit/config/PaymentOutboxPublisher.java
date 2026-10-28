package com.mapit.config;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentEventPublisherPort;
import com.mapit.shared.tenant.TenantScope;

import tools.jackson.databind.ObjectMapper;

@Component
public class PaymentOutboxPublisher implements PaymentEventPublisherPort {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final Clock clock;
  public PaymentOutboxPublisher(JdbcTemplate jdbc, ObjectMapper json, Clock clock) {
    this.jdbc = jdbc; this.json = json; this.clock = clock;
  }
  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void publish(Payment payment) {
    enqueue(payment.tenantId(), payment.establishmentId(), payment.reservationId(), payment.id(), payment.status().name(), "payment.status.changed");
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void publishArrival(com.mapit.shared.tenant.TenantId tenantId, UUID establishmentId, UUID reservationId, UUID paymentId) {
    enqueue(tenantId, establishmentId, reservationId, paymentId, "CONFIRMED", "reservation.checked_in");
  }

  private void enqueue(com.mapit.shared.tenant.TenantId tenantId, UUID establishmentId, UUID reservationId,
      UUID paymentId, String status, String eventType) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
    UUID eventId = UUID.randomUUID();
    var now = clock.instant();
    String payload = json.writeValueAsString(Map.of("eventId", eventId, "eventType", eventType,
        "schemaVersion", 1, "occurredAt", now.toString(), "reservationId", reservationId,
        "paymentId", paymentId, "establishmentId", establishmentId, "status", status));
    jdbc.update("""
        insert into realtime_event_outbox(event_id,tenant_id,event_type,schema_version,occurred_at,
          establishment_id,aggregate_version,payload,reservation_id)
        values(?,?,?,1,?,?,1,?::jsonb,?)
        """, eventId, tenantId.value(), eventType, Timestamp.from(now), establishmentId, payload, reservationId);
  }
}
