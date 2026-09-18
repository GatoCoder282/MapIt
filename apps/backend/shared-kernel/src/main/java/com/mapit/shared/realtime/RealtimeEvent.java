package com.mapit.shared.realtime;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Evento interno de tiempo real.
 *
 * <p>El tenant forma parte del contrato interno para que el outbox nunca pueda mezclar filas
 * entre empresas. El adaptador STOMP lo omite deliberadamente del envelope público: el tenant
 * ya está fijado por el JWT que autorizó la suscripción.
 */
public record RealtimeEvent(
    UUID eventId,
    String eventType,
    int schemaVersion,
    Instant occurredAt,
    TenantId tenantId,
    UUID establishmentId,
    Optional<UUID> sectorId,
    UUID spaceElementId,
    Optional<SpaceElementState> previousState,
    SpaceElementState state,
    long aggregateVersion) {

  public static final String SPACE_ELEMENT_STATE_CHANGED_V1 = "space-element.state.changed.v1";
  public static final int CURRENT_SCHEMA_VERSION = 1;

  public RealtimeEvent {
    Objects.requireNonNull(eventId, "eventId no puede ser null");
    Objects.requireNonNull(eventType, "eventType no puede ser null");
    Objects.requireNonNull(occurredAt, "occurredAt no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(sectorId, "sectorId no puede ser null");
    Objects.requireNonNull(spaceElementId, "spaceElementId no puede ser null");
    Objects.requireNonNull(previousState, "previousState no puede ser null");
    Objects.requireNonNull(state, "state no puede ser null");
    if (!SPACE_ELEMENT_STATE_CHANGED_V1.equals(eventType)) {
      throw new IllegalArgumentException("eventType no soportado: " + eventType);
    }
    if (schemaVersion != CURRENT_SCHEMA_VERSION) {
      throw new IllegalArgumentException("schemaVersion no soportado: " + schemaVersion);
    }
    if (aggregateVersion < 1) {
      throw new IllegalArgumentException("aggregateVersion debe ser positivo");
    }
  }

  /** Crea el evento versionado que usa HUT-01. */
  public static RealtimeEvent spaceElementStateChanged(
      UUID eventId,
      Instant occurredAt,
      TenantId tenantId,
      UUID establishmentId,
      Optional<UUID> sectorId,
      UUID spaceElementId,
      Optional<SpaceElementState> previousState,
      SpaceElementState state,
      long aggregateVersion) {
    return new RealtimeEvent(
        eventId,
        SPACE_ELEMENT_STATE_CHANGED_V1,
        CURRENT_SCHEMA_VERSION,
        occurredAt,
        tenantId,
        establishmentId,
        sectorId,
        spaceElementId,
        previousState,
        state,
        aggregateVersion);
  }
}
