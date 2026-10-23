package com.mapit.spaces.application.layout;

/**
 * Un sector no cabe en el lienzo de la planta, o un elemento no cabe en el sector
 * (HU-4.01, RN-10). El frontend clampea; esta regla es la red del backend.
 */
public class LayoutOutOfBoundsException extends RuntimeException {
  public LayoutOutOfBoundsException(String detail) {
    super(detail);
  }
}
