package com.mapit.spaces.domain.layout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PlacementTest {

  @Test
  void acepta_origen_y_rotacion_normalizada() {
    Placement p = Placement.of(0, 0, 720);
    assertEquals(0, p.x());
    assertEquals(0, p.y());
    assertEquals(0, p.rotation());
  }

  @Test
  void normaliza_rotaciones_negativas_y_mayores_de_360() {
    assertEquals(270, Placement.of(10, 10, -90).rotation());
    assertEquals(10, Placement.of(10, 10, 370).rotation());
  }

  @Test
  void rechaza_coordenadas_negativas() {
    assertThrows(IllegalArgumentException.class, () -> Placement.of(-1, 0, 0));
    assertThrows(IllegalArgumentException.class, () -> Placement.of(0, -0.5, 0));
  }

  @Test
  void rechaza_valores_no_finitos() {
    assertThrows(IllegalArgumentException.class, () -> Placement.of(Double.NaN, 0, 0));
    assertThrows(IllegalArgumentException.class, () -> Placement.of(0, 0, Double.POSITIVE_INFINITY));
  }
}
