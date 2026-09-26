package com.mapit.operations.application.state;

import java.time.Instant;
import java.util.UUID;

import com.mapit.operations.domain.state.SpaceElementStateChange;
import com.mapit.shared.realtime.SpaceElementState;

/** Proyección consultable de una entrada de auditoría. */
public record SpaceElementStateChangeResult(
    UUID id,
    UUID elementId,
    SpaceElementState previousState,
    SpaceElementState newState,
    UUID changedBy,
    Instant changedAt) {

  static SpaceElementStateChangeResult from(SpaceElementStateChange change) {
    return new SpaceElementStateChangeResult(
        change.id(),
        change.elementId(),
        change.previousState(),
        change.newState(),
        change.changedBy(),
        change.changedAt());
  }
}
