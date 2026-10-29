package com.mapit.shared.spaces;

import org.jspecify.annotations.Nullable;

public final class SpaceDisplayName {
  private SpaceDisplayName() {}

  public static String format(String type, @Nullable String label) {
    if (label != null && !label.isBlank()) return label.trim();
    return switch (type) {
      case "TABLE" -> "Mesa";
      case "BAR" -> "Barra";
      case "SECTOR_ZONE" -> "Zona";
      case "STAGE" -> "Escenario";
      case "SEAT" -> "Butaca";
      case "ROOM" -> "Habitación";
      case "DECOR" -> "Decoración";
      default -> throw new IllegalArgumentException("Tipo espacial inválido");
    } + " sin nombre";
  }
}
