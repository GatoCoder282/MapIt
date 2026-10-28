package com.mapit.shared.audit;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Evento interno, inmutable y controlado por el backend, que se añadirá a la bitácora. */
public record AuditEvent(
    UUID eventId,
    TenantId tenantId,
    UUID actorId,
    Instant occurredAt,
    AuditResourceType resourceType,
    UUID resourceId,
    AuditEventType eventType,
    Map<String, String> details) {

  private static final int MAX_DETAIL_VALUE_LENGTH = 200;

  public AuditEvent {
    Objects.requireNonNull(eventId, "eventId no puede ser null");
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
    Map<String, String> safeDetails = new LinkedHashMap<>();
    for (Map.Entry<String, String> detail : details.entrySet()) {
      String key = Objects.requireNonNull(detail.getKey(), "La clave de detalle no puede ser null");
      String value =
          Objects.requireNonNull(detail.getValue(), "El valor de detalle no puede ser null");
      if (!eventType.allowedDetailKeys().contains(key)) {
        throw new IllegalArgumentException("Detalle no permitido para " + eventType + ": " + key);
      }
      if (value.isBlank() || value.length() > MAX_DETAIL_VALUE_LENGTH) {
        throw new IllegalArgumentException(
            "El detalle " + key + " debe tener entre 1 y 200 caracteres");
      }
      safeDetails.put(key, value);
    }
    if (!safeDetails.keySet().equals(eventType.allowedDetailKeys())) {
      throw new IllegalArgumentException(
          "El evento debe contener exactamente los detalles requeridos: "
              + eventType.allowedDetailKeys());
    }
    details = Map.copyOf(safeDetails);
  }
}
