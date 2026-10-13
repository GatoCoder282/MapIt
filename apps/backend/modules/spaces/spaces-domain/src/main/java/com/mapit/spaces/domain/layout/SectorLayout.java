package com.mapit.spaces.domain.layout;

import java.util.List;
import java.util.Objects;

import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.spaceelement.SpaceElement;

/**
 * Proyección de lectura del sector dentro del layout de su planta (HU-4.01):
 * la fila del sector (con su {@code Placement} y {@code Geometry}) más sus
 * elementos vivos en solo-lectura. RN-3: es una lente sobre las mismas filas,
 * nunca una copia independiente.
 */
public record SectorLayout(Sector sector, List<SpaceElement> elements) {

  public SectorLayout {
    Objects.requireNonNull(sector, "sector no puede ser null");
    elements = List.copyOf(Objects.requireNonNull(elements, "elements no puede ser null"));
  }
}
