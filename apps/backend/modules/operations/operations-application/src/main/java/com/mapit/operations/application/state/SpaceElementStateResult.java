package com.mapit.operations.application.state;

import java.time.Instant;
import java.util.UUID;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.shared.realtime.SpaceElementState;

/** Resultado estable del caso de uso, independiente de HTTP y persistencia. */
public record SpaceElementStateResult(
    UUID id, UUID sectorId, SpaceElementState state, Instant updatedAt) {

  static SpaceElementStateResult from(OperationalSpaceElement element) {
    return new SpaceElementStateResult(
        element.id(), element.sectorId(), element.state(), element.updatedAt());
  }
}
