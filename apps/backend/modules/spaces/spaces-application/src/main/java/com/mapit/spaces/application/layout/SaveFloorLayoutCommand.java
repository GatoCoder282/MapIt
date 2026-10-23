package com.mapit.spaces.application.layout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Comando de guardado por lotes de la vista de planta (HU-4.01, RN-6/RN-7):
 * dimensiones del lienzo + colocaciones de sectores. Cada recurso trae el
 * {@code updatedAt} que el cliente observó al cargar.
 */
public record SaveFloorLayoutCommand(
    double canvasWidth,
    double canvasHeight,
    Instant floorUpdatedAt,
    List<SectorPlacement> sectors) {

  /** Colocación deseada de un sector dentro del lienzo. */
  public record SectorPlacement(UUID id, double x, double y, double rotation, Instant updatedAt) {}
}
