package com.mapit.spaces.domain.layout;

/**
 * Colocación de un sector dentro del lienzo de su planta (HU-4.01, RN-2/RN-6).
 *
 * <p>{@code x}/{@code y} son relativas a la esquina superior izquierda de la planta
 * y nunca negativas; {@code rotation} se normaliza a {@code [0, 360)}. Es inmutable:
 * toda edición devuelve una instancia nueva, igual que el resto del dominio.
 */
public record Placement(double x, double y, double rotation) {

  public Placement {
    if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(rotation)) {
      throw new IllegalArgumentException("x, y y rotation deben ser números finitos");
    }
    if (x < 0 || y < 0) {
      throw new IllegalArgumentException(
          "x e y son relativas al lienzo de la planta y no pueden ser negativas");
    }
    rotation = ((rotation % 360) + 360) % 360;
  }

  public static Placement of(double x, double y, double rotation) {
    return new Placement(x, y, rotation);
  }

  /** Colocación por defecto de un sector recién creado: esquina del lienzo, sin rotar. */
  public static Placement origin() {
    return new Placement(0, 0, 0);
  }

  /**
   * Verifica que la caja envolvente (AABB) del rectángulo rotado cabe dentro del
   * lienzo {@code canvasWidth}×{@code canvasHeight} desde esta colocación.
   *
   * <p>La misma fórmula que el {@code dragBoundFunc} del adaptador Konva (RN-10): las
   * cuatro esquinas del rectángulo rotado alrededor de su origen (0,0) pueden caer en
   * coordenadas negativas, así que el encaje es {@code x ≥ −minX} y
   * {@code x + maxX ≤ canvasWidth} (no {@code x + anchoAabb}, que desplaza la ancla).
   */
  public boolean fitsIn(Geometry geometry, double canvasWidth, double canvasHeight) {
    double rad = Math.toRadians(rotation);
    double cos = Math.cos(rad);
    double sin = Math.sin(rad);
    double w = geometry.width();
    double h = geometry.height();
    double[] xs = {0, w * cos, -h * sin, w * cos - h * sin};
    double[] ys = {0, w * sin, h * cos, w * sin + h * cos};
    double minX = Math.min(Math.min(xs[0], xs[1]), Math.min(xs[2], xs[3]));
    double maxX = Math.max(Math.max(xs[0], xs[1]), Math.max(xs[2], xs[3]));
    double minY = Math.min(Math.min(ys[0], ys[1]), Math.min(ys[2], ys[3]));
    double maxY = Math.max(Math.max(ys[0], ys[1]), Math.max(ys[2], ys[3]));
    return x >= -minX && x + maxX <= canvasWidth
        && y >= -minY && y + maxY <= canvasHeight;
  }
}
