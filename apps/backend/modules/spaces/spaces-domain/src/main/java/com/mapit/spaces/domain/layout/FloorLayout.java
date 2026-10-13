package com.mapit.spaces.domain.layout;

import java.util.List;
import java.util.Objects;

import com.mapit.spaces.domain.floor.Floor;

/**
 * Proyección de lectura agregada de una planta (HU-4.01): la fila del piso (con el
 * lienzo {@code canvasWidth}×{@code canvasHeight}) y, por cada sector vivo, su
 * colocación junto a sus elementos vivos.
 */
public record FloorLayout(Floor floor, List<SectorLayout> sectors) {

  public FloorLayout {
    Objects.requireNonNull(floor, "floor no puede ser null");
    sectors = List.copyOf(Objects.requireNonNull(sectors, "sectors no puede ser null"));
  }
}
