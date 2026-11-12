package com.mapit.shared.vertical;

import java.time.Duration;
import java.time.LocalTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.mapit.shared.flags.FeatureFlag;

/**
 * Única fuente de las reglas por vertical (spec D4 y D5).
 *
 * <p>{@code STAGE} y {@code DECOR} se dibujan pero no se reservan en ninguna vertical. La matriz
 * de tipos admitidos es la de HU-2.03; la de reservables, la de HU-7.01/7.02.
 */
public final class VerticalCatalog {

  private static final Set<String> COMUNES =
      Set.of("TABLE", "BAR", "SECTOR_ZONE", "STAGE", "DECOR");

  private static final Map<Vertical, VerticalProfile> PERFILES = new EnumMap<>(Vertical.class);

  static {
    PERFILES.put(
        Vertical.RESTAURANT,
        porHoras(
            Vertical.RESTAURANT,
            BookingMode.SHIFT,
            COMUNES,
            Set.of("TABLE", "BAR", "SECTOR_ZONE"),
            false,
            Duration.ofHours(6),
            Optional.empty()));
    PERFILES.put(
        Vertical.NIGHTCLUB,
        porHoras(
            Vertical.NIGHTCLUB,
            BookingMode.NIGHT,
            COMUNES,
            Set.of("TABLE", "BAR", "SECTOR_ZONE"),
            true,
            Duration.ofHours(12),
            Optional.empty()));
    PERFILES.put(
        Vertical.EVENT_HALL,
        porHoras(
            Vertical.EVENT_HALL,
            BookingMode.EVENT,
            Set.of("TABLE", "BAR", "SECTOR_ZONE", "STAGE", "SEAT", "DECOR"),
            Set.of("SEAT", "TABLE", "SECTOR_ZONE"),
            true,
            Duration.ofHours(24),
            Optional.of(FeatureFlag.VERTICAL_EVENT_HALL)));
    PERFILES.put(
        Vertical.HOTEL,
        new VerticalProfile(
            Vertical.HOTEL,
            BookingMode.STAY,
            Set.of("ROOM", "DECOR"),
            Set.of("ROOM"),
            true,
            null,
            1,
            30,
            LocalTime.of(15, 0),
            LocalTime.of(12, 0),
            Optional.of(FeatureFlag.VERTICAL_HOTEL)));
  }

  private VerticalCatalog() {}

  /** Perfil de la vertical; nunca nulo porque el catálogo cubre los cuatro valores. */
  public static VerticalProfile of(Vertical vertical) {
    return PERFILES.get(vertical);
  }

  /** Perfil a partir del valor persistido ({@code establishment.type}). */
  public static VerticalProfile of(String vertical) {
    return of(Vertical.of(vertical));
  }

  private static VerticalProfile porHoras(
      Vertical vertical,
      BookingMode mode,
      Set<String> allowed,
      Set<String> reservable,
      boolean overnight,
      Duration maxDuration,
      Optional<FeatureFlag> flag) {
    return new VerticalProfile(
        vertical, mode, allowed, reservable, overnight, maxDuration, null, null, null, null, flag);
  }
}
