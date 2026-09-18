package com.mapit.operations.infrastructure.realtime;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.SpaceElementState;

/** Forma pública del evento: conserva el envelope, pero no expone tenant_id. */
record RealtimeWireEnvelope(
    UUID eventId,
    String eventType,
    int schemaVersion,
    Instant occurredAt,
    UUID establishmentId,
    @Nullable UUID sectorId,
    long aggregateVersion,
    RealtimeWirePayload payload) {

  static RealtimeWireEnvelope from(RealtimeEvent event) {
    return new RealtimeWireEnvelope(
        event.eventId(),
        event.eventType(),
        event.schemaVersion(),
        event.occurredAt(),
        event.establishmentId(),
        event.sectorId().orElse(null),
        event.aggregateVersion(),
        new RealtimeWirePayload(
            event.spaceElementId(), event.previousState().orElse(null), event.state()));
  }
}

record RealtimeWirePayload(
    UUID spaceElementId, @Nullable SpaceElementState previousState, SpaceElementState state) {}
