package com.mapit.spaces.application.spaceelement;

import com.mapit.spaces.domain.spaceelement.SpaceElementId;

/** El elemento tiene reservas activas y no se puede dar de baja (HU-4.01, RN-1). */
public class SpaceElementHasActiveReservationsException extends RuntimeException {

  public SpaceElementHasActiveReservationsException(SpaceElementId elementId) {
    super("El elemento " + elementId + " tiene reservas activas y no se puede eliminar");
  }
}
