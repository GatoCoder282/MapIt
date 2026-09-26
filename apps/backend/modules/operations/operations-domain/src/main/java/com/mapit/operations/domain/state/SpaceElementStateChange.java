package com.mapit.operations.domain.state;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/** Registro inmutable de quién cambió el estado de un elemento, cuándo y cómo. */
public record SpaceElementStateChange(
    UUID id,
    TenantId tenantId,
    UUID sectorId,
    UUID elementId,
    SpaceElementState previousState,
    SpaceElementState newState,
    UUID changedBy,
    Instant changedAt) {

  public SpaceElementStateChange {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(sectorId, "sectorId no puede ser null");
    Objects.requireNonNull(elementId, "elementId no puede ser null");
    Objects.requireNonNull(previousState, "previousState no puede ser null");
    Objects.requireNonNull(newState, "newState no puede ser null");
    Objects.requireNonNull(changedBy, "changedBy no puede ser null");
    Objects.requireNonNull(changedAt, "changedAt no puede ser null");
    if (previousState == newState) {
      throw new IllegalArgumentException("La auditoría exige un cambio de estado real");
    }
  }
}
