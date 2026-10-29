package com.mapit.shared.vertical;

import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import org.jspecify.annotations.Nullable;

/**
 * Forma publicada del perfil de vertical (schema {@code VerticalProfile} del contrato).
 *
 * <p>La devuelven spaces (staff) y reservations (mapa público). Vive aquí para que ambos
 * contextos expongan exactamente lo mismo; bootstrap le aplica la serialización de nulos
 * explícitos que exige el contrato.
 */
public record VerticalProfileView(
    String establishmentType,
    BookingMode bookingMode,
    boolean enabled,
    List<String> allowedElementTypes,
    List<String> reservableElementTypes,
    boolean allowsOvernight,
    @Nullable Long maxDurationMinutes,
    @Nullable Integer minNights,
    @Nullable Integer maxNights,
    @Nullable String defaultStartTime,
    @Nullable String defaultEndTime) {

  /** Orden estable de los tipos (el de {@code SpaceElementType}), para respuestas deterministas. */
  private static final List<String> ORDEN =
      List.of("TABLE", "BAR", "SECTOR_ZONE", "STAGE", "SEAT", "ROOM", "DECOR");

  public static VerticalProfileView of(VerticalProfile profile, boolean enabled) {
    return new VerticalProfileView(
        profile.vertical().name(),
        profile.bookingMode(),
        enabled,
        ordered(profile.allowedElementTypes()),
        ordered(profile.reservableElementTypes()),
        profile.allowsOvernight(),
        profile.maxDuration() == null ? null : profile.maxDuration().toMinutes(),
        profile.minNights(),
        profile.maxNights(),
        hhmm(profile.defaultStartTime()),
        hhmm(profile.defaultEndTime()));
  }

  private static List<String> ordered(Set<String> types) {
    return ORDEN.stream().filter(types::contains).toList();
  }

  private static @Nullable String hhmm(@Nullable LocalTime time) {
    return time == null ? null : "%02d:%02d".formatted(time.getHour(), time.getMinute());
  }
}
