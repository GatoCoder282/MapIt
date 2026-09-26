package com.mapit.operations.domain.state;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/** Vista operativa mínima de un elemento espacial para CU-09. */
public record OperationalSpaceElement(
    UUID id,
    TenantId tenantId,
    UUID sectorId,
    SpaceElementState state,
    Instant updatedAt) {

  public OperationalSpaceElement {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(sectorId, "sectorId no puede ser null");
    Objects.requireNonNull(state, "state no puede ser null");
    Objects.requireNonNull(updatedAt, "updatedAt no puede ser null");
  }

  /** Cambia el estado; repetir el estado actual es una operación idempotente. */
  public OperationalSpaceElement changeState(SpaceElementState newState, Instant now) {
    Objects.requireNonNull(newState, "newState no puede ser null");
    Objects.requireNonNull(now, "now no puede ser null");
    if (state == newState) {
      return this;
    }
    return new OperationalSpaceElement(id, tenantId, sectorId, newState, now);
  }
}
