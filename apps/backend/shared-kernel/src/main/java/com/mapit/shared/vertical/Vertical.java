package com.mapit.shared.vertical;

import java.util.Arrays;

/**
 * Las cuatro verticales que atiende el mismo motor.
 *
 * <p>Coincide en valores con {@code EstablishmentType} (spaces) y {@code BusinessVertical}
 * (platform), que siguen existiendo en sus contextos; este enum es la clave del catálogo
 * compartido y se obtiene siempre por nombre con {@link #of(String)}.
 */
public enum Vertical {
  RESTAURANT,
  NIGHTCLUB,
  EVENT_HALL,
  HOTEL;

  /** Traduce el valor persistido ({@code establishment.type}) sin aceptar valores inventados. */
  public static Vertical of(String value) {
    try {
      return valueOf(value);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "Vertical inválida: '%s'. Valores: %s".formatted(value, Arrays.toString(values())), ex);
    }
  }
}
