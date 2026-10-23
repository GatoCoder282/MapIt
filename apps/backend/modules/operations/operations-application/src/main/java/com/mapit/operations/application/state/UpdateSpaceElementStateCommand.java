package com.mapit.operations.application.state;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.realtime.SpaceElementState;

/** Datos validados por el borde HTTP para cambiar un estado. */
public record UpdateSpaceElementStateCommand(
    UUID sectorId, UUID elementId, SpaceElementState state) {

  public UpdateSpaceElementStateCommand {
    Objects.requireNonNull(sectorId, "sectorId no puede ser null");
    Objects.requireNonNull(elementId, "elementId no puede ser null");
    Objects.requireNonNull(state, "state no puede ser null");
  }
}
