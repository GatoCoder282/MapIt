package com.mapit.operations.domain.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;

class AuditLogTest {

  @Test
  void se_construye_desde_el_evento_y_conserva_detalles_inmutables() {
    Map<String, String> details = new HashMap<>();
    details.put("previousState", "AVAILABLE");
    details.put("newState", "OCCUPIED");
    details.put("sectorId", UUID.randomUUID().toString());
    AuditEvent event =
        new AuditEvent(
            UUID.randomUUID(),
            TenantId.of("audit-a"),
            UUID.randomUUID(),
            Instant.parse("2026-10-22T18:00:00Z"),
            AuditResourceType.SPACE_ELEMENT,
            UUID.randomUUID(),
            AuditEventType.SPACE_ELEMENT_STATE_CHANGED,
            details);

    AuditLog auditLog = AuditLog.from(event);
    details.put("newState", "AVAILABLE");

    assertThat(auditLog.id()).isEqualTo(event.eventId());
    assertThat(auditLog.details()).containsEntry("newState", "OCCUPIED");
  }
}
