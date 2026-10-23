package com.mapit.spaces.application.layout;

import java.util.List;
import java.util.UUID;

/**
 * Conflicto de concurrencia optimista en un guardado por lotes (HU-4.01, RN-7):
 * alguna fila cambió desde que el cliente la leyó. Lleva los ids en conflicto
 * para que la UI ofrezca recargar solo lo que chocó.
 */
public class LayoutConflictException extends RuntimeException {

  private final List<UUID> conflictingIds;

  public LayoutConflictException(List<UUID> conflictingIds) {
    super("Guardado en conflicto: recursos modificados por otra edición " + conflictingIds);
    this.conflictingIds = List.copyOf(conflictingIds);
  }

  public List<UUID> conflictingIds() {
    return conflictingIds;
  }
}
