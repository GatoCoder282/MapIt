package com.mapit.spaces.application.layout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Comando de guardado por lotes de la distribución interna de un sector
 * (HU-4.01, RN-6/RN-7): dimensiones del sector + geometría de sus elementos.
 * El estado operativo jamás viaja aquí (RN-9).
 */
public record SaveSectorLayoutCommand(
    double width,
    double height,
    Instant sectorUpdatedAt,
    List<ElementGeometry> elements) {

  /** Geometría deseada de un elemento dentro del sector. */
  public record ElementGeometry(
      UUID id, double x, double y, double width, double height, double rotation,
      Instant updatedAt) {}
}
