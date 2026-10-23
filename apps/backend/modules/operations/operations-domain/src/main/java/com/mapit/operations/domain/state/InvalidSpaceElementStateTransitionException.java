package com.mapit.operations.domain.state;

import com.mapit.shared.realtime.SpaceElementState;

/** Indica que una transición no pertenece al ciclo operativo permitido. */
public class InvalidSpaceElementStateTransitionException extends RuntimeException {

  private final SpaceElementState currentState;
  private final SpaceElementState requestedState;

  public InvalidSpaceElementStateTransitionException(
      SpaceElementState currentState, SpaceElementState requestedState) {
    super("No se permite cambiar el estado de %s a %s".formatted(currentState, requestedState));
    this.currentState = currentState;
    this.requestedState = requestedState;
  }

  public SpaceElementState currentState() {
    return currentState;
  }

  public SpaceElementState requestedState() {
    return requestedState;
  }
}
