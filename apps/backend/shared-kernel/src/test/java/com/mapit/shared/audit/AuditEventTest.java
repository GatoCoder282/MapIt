package com.mapit.shared.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class AuditEventTest {

  private static final UUID EVENT_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID ACTOR_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
  private static final UUID RESOURCE_ID = UUID.fromString("10000000-0000-0000-0000-000000000003");
  private static final Instant OCCURRED_AT = Instant.parse("2026-10-22T18:00:00Z");

  @Test
  void conserva_solo_una_copia_inmutable_de_los_detalles_permitidos() {
    Map<String, String> details = new HashMap<>();
    details.put("status", "CREATED");
    details.put("establishmentId", UUID.randomUUID().toString());

    AuditEvent event = reservationCreated(details);
    details.put("status", "CANCELLED");

    assertThat(event.details()).containsEntry("status", "CREATED");
    assertThatThrownBy(() -> event.details().put("status", "CANCELLED"))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void rechaza_un_evento_que_no_corresponde_al_tipo_de_recurso() {
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new AuditEvent(
                    EVENT_ID,
                    TenantId.of("audit-a"),
                    ACTOR_ID,
                    OCCURRED_AT,
                    AuditResourceType.SPACE_ELEMENT,
                    RESOURCE_ID,
                    AuditEventType.RESERVATION_CREATED,
                    Map.of("status", "CREATED")))
        .withMessageContaining("tipo de recurso");
  }

  @Test
  void rechaza_claves_no_permitidas_incluidos_secretos() {
    assertThatIllegalArgumentException()
        .isThrownBy(() -> reservationCreated(Map.of("password", "no-debe-guardarse")))
        .withMessageContaining("Detalle no permitido");
  }

  @Test
  void exige_todos_los_detalles_minimos_del_tipo_de_evento() {
    assertThatIllegalArgumentException()
        .isThrownBy(() -> reservationCreated(Map.of("status", "CREATED")))
        .withMessageContaining("detalles requeridos");
  }

  @Test
  void rechaza_valores_vacios_o_excesivos() {
    assertThatIllegalArgumentException()
        .isThrownBy(() -> reservationCreated(Map.of("status", " ")));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> reservationCreated(Map.of("status", "x".repeat(201))));
  }

  private AuditEvent reservationCreated(Map<String, String> details) {
    return new AuditEvent(
        EVENT_ID,
        TenantId.of("audit-a"),
        ACTOR_ID,
        OCCURRED_AT,
        AuditResourceType.RESERVATION,
        RESOURCE_ID,
        AuditEventType.RESERVATION_CREATED,
        details);
  }
}
