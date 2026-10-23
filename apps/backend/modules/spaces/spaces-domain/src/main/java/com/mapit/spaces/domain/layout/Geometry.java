package com.mapit.spaces.domain.layout;

/**
 * Dimensiones intrínsecas de un sector (HU-4.01, RN-2/RN-10): su propio tamaño, que
 * es además el marco de coordenadas de sus elementos (el origen es su esquina
 * superior izquierda; los elementos no pueden salirse).
 *
 * <p>Mínimo 20×20, en simetría con el CHECK de {@code sector} (V18).
 */
public record Geometry(double width, double height) {

  public static final double MIN_DIMENSION = 20.0;

  public Geometry {
    if (!Double.isFinite(width) || !Double.isFinite(height)) {
      throw new IllegalArgumentException("width y height deben ser números finitos");
    }
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      throw new IllegalArgumentException(
          "width y height deben ser >= %s".formatted(MIN_DIMENSION));
    }
  }

  public static Geometry of(double width, double height) {
    return new Geometry(width, height);
  }

  /** Tamaño por defecto de un sector recién creado (alineado con el default de V18). */
  public static Geometry defaultSector() {
    return new Geometry(800, 600);
  }
}
