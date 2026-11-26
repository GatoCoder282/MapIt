package com.mapit.operations.application.state;

import java.util.UUID;

/** Oculta si el elemento no existe, está dado de baja o está fuera del ámbito autorizado. */
public final class OperationalSpaceElementNotFoundException extends RuntimeException {

  public OperationalSpaceElementNotFoundException(UUID elementId) {
    super("Elemento espacial no encontrado: " + elementId);
  }
}
