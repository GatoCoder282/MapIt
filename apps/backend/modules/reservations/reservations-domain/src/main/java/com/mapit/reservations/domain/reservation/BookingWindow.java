package com.mapit.reservations.domain.reservation;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

import com.mapit.shared.vertical.BookingMode;
import com.mapit.shared.vertical.VerticalProfile;

/**
 * Ventana temporal que admite una vertical (HU-7.01/7.02, spec D4). Es la estrategia del modo
 * de reserva: el mismo {@code CreateReservation} la aplica sin saber de qué vertical se trata.
 *
 * <p>Las fechas se evalúan en la zona horaria del establecimiento. El intervalo es
 * semiabierto, así que un turno que termina a las 00:00 sigue siendo «del mismo día».
 */
public sealed interface BookingWindow {

  /**
   * @throws IllegalArgumentException si el intervalo no cabe en la ventana de la vertical
   */
  void validate(ReservationTimeRange range, ZoneId zone);

  static BookingWindow of(VerticalProfile profile) {
    Objects.requireNonNull(profile, "profile no puede ser null");
    return profile.bookingMode() == BookingMode.STAY
        ? new Stay(profile.minNights(), profile.maxNights())
        : new Hourly(profile.bookingMode(), profile.maxDuration(), profile.allowsOvernight());
  }

  /** Turno, noche o evento: duración máxima y, si no cruza medianoche, mismo día local. */
  record Hourly(BookingMode mode, Duration maxDuration, boolean allowsOvernight)
      implements BookingWindow {

    @Override
    public void validate(ReservationTimeRange range, ZoneId zone) {
      Duration duration = Duration.between(range.startsAt(), range.endsAt());
      if (duration.compareTo(maxDuration) > 0) {
        throw new IllegalArgumentException(
            "Una reserva de %s no puede durar más de %d h"
                .formatted(nombre(mode), maxDuration.toHours()));
      }
      if (!allowsOvernight && !localDay(range.startsAt(), zone).equals(lastLocalDay(range, zone))) {
        throw new IllegalArgumentException(
            "Un turno debe empezar y terminar el mismo día local del establecimiento");
      }
    }
  }

  /** Estadía: se cuenta en noches entre el día local de llegada y el de salida. */
  record Stay(int minNights, int maxNights) implements BookingWindow {

    @Override
    public void validate(ReservationTimeRange range, ZoneId zone) {
      long nights =
          ChronoUnit.DAYS.between(localDay(range.startsAt(), zone), localDay(range.endsAt(), zone));
      if (nights < minNights || nights > maxNights) {
        throw new IllegalArgumentException(
            "Una estadía debe durar entre %d y %d noches (solicitadas: %d)"
                .formatted(minNights, maxNights, nights));
      }
    }
  }

  private static LocalDate localDay(Instant instant, ZoneId zone) {
    return instant.atZone(zone).toLocalDate();
  }

  /** Día del último instante ocupado: {@code [inicio, fin)} no incluye el fin. */
  private static LocalDate lastLocalDay(ReservationTimeRange range, ZoneId zone) {
    return localDay(range.endsAt().minusNanos(1), zone);
  }

  private static String nombre(BookingMode mode) {
    return switch (mode) {
      case SHIFT -> "turno";
      case NIGHT -> "noche";
      case EVENT -> "evento";
      case STAY -> "estadía";
    };
  }
}
