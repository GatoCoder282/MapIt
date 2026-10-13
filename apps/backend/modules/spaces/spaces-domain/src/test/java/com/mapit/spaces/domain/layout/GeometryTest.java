package com.mapit.spaces.domain.layout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class GeometryTest {

  @Test
  void acepta_dimensiones_minimas() {
    Geometry g = Geometry.of(20, 20);
    assertEquals(20, g.width());
    assertEquals(20, g.height());
  }

  @Test
  void rechaza_dimensiones_menores_al_minimo() {
    assertThrows(IllegalArgumentException.class, () -> Geometry.of(19.9, 100));
    assertThrows(IllegalArgumentException.class, () -> Geometry.of(100, 0));
  }

  @Test
  void rechaza_valores_no_finitos() {
    assertThrows(IllegalArgumentException.class, () -> Geometry.of(Double.NaN, 20));
    assertThrows(IllegalArgumentException.class, () -> Geometry.of(20, Double.NEGATIVE_INFINITY));
  }

  @Test
  void cabe_dentro_de_un_lienzo_respetando_la_rotacion() {
    Geometry g = Geometry.of(100, 50);
    // Sin rotación: cabe en 200x200; desplazado 1px más allá del borde, no cabe
    assertEquals(true, Placement.of(0, 0, 0).fitsIn(g, 200, 200));
    assertEquals(false, Placement.of(101, 0, 0).fitsIn(g, 200, 200));
    // Rotada 90° la AABB abraza el origen: en x=0 sale 50px por la izquierda;
    // en x=50 queda pegada al borde (la misma cuenta que hace Konva al clampear).
    assertEquals(false, Placement.of(0, 0, 90).fitsIn(g, 60, 120));
    assertEquals(true, Placement.of(50, 0, 90).fitsIn(g, 60, 120));
    // 100 rotado en alto no cabe en lienzo de 80 de alto
    assertEquals(false, Placement.of(50, 0, 90).fitsIn(g, 60, 80));
  }

  @Test
  void la_aabb_rotada_no_esta_anclada_en_el_origen_45_grados_es_el_caso() {
    // Un cuadrado 100x100 rotado 90° en (0,0) ocupa x ∈ [-100, 0]: el rectángulo
    // rotado abraza el ORIGEN del sector, no su esquina superior izquierda.
    // (El anclaje real lo calcula Konva con las 4 esquinas; fitsIn debe coincidir.)
    Geometry cuadrado = Geometry.of(100, 100);
    assertEquals(false, Placement.of(0, 0, 90).fitsIn(cuadrado, 1000, 1000),
        "rotado 90° en x=0 sale por la izquierda del lienzo");
    assertEquals(true, Placement.of(100, 0, 90).fitsIn(cuadrado, 1000, 1000),
        "con x >= |minX| de la AABB sí cabe pegado al borde");
    // A 45°, una barra 200x60 ocupa ~183x183 de AABB: cabe desplazada, no en el origen
    Geometry barra = Geometry.of(200, 60);
    assertEquals(false, Placement.of(0, 0, 45).fitsIn(barra, 500, 500));
    double minXAbs = 60 * Math.sin(Math.toRadians(45)); // ≈ 42.4
    double aabb    = 200 * Math.cos(Math.toRadians(45)) + 60 * Math.sin(Math.toRadians(45));
    assertEquals(true,
        Placement.of(0 + minXAbs + 1, 1, 45).fitsIn(barra, 500, 500 - 0) && aabb < 500);
  }
}
