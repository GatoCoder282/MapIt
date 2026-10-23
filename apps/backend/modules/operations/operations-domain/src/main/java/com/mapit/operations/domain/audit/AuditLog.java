package com.mapit.operations.domain.audit;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;

/** Entrada inmutable y append-only de la bitácora de negocio. */
public record AuditLog(
    UUID id,
    TenantId tenantId,
    UUID actorId,
    Instant occurredAt,
    AuditResourceType resourceType,
    UUID resourceId,
    AuditEventType eventType,
    Map<String, String> details) {

  public AuditLog {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(actorId, "actorId no puede ser null");
    Objects.requireNonNull(occurredAt, "occurredAt no puede ser null");
    Objects.requireNonNull(resourceType, "resourceType no puede ser null");
    Objects.requireNonNull(resourceId, "resourceId no puede ser null");
    Objects.requireNonNull(eventType, "eventType no puede ser null");
    Objects.requireNonNull(details, "details no puede ser null");
    if (eventType.resourceType() != resourceType) {
      throw new IllegalArgumentException("El evento no corresponde al tipo de recurso");
    }
    if (!details.keySet().equals(eventType.allowedDetailKeys())) {
      throw new IllegalArgumentException("La entrada no contiene los detalles exactos del evento");
    }
    for (Map.Entry<String, String> detail : details.entrySet()) {
      Objects.requireNonNull(detail.getKey(), "La clave de detalle no puede ser null");
      String value =
          Objects.requireNonNull(detail.getValue(), "El valor de detalle no puede ser null");
      if (value.isBlank() || value.length() > 200) {
        throw new IllegalArgumentException(
            "El detalle " + detail.getKey() + " debe tener entre 1 y 200 caracteres");
      }
    }
    details = Map.copyOf(details);
  }

  public static AuditLog from(AuditEvent event) {
    Objects.requireNonNull(event, "event no puede ser null");
    return new AuditLog(
        event.eventId(),
        event.tenantId(),
        event.actorId(),
        event.occurredAt(),
        event.resourceType(),
        event.resourceId(),
        event.eventType(),
        event.details());
  }
}
