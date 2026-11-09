package com.mapit.reservations.domain.reservation;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.jspecify.annotations.Nullable;

/**
 * Traduce la fecha y las horas locales del portal público a un intervalo absoluto.
 *
 * <p>HU-7.01/7.02: el fin puede caer otro día. Con {@code endDate} explícito (salida del hotel)
 * se usa tal cual; sin él, una vertical que admite noches (discoteca, salón) interpreta
 * {@code endTime ≤ startTime} como «termina al día siguiente», y el resto lo rechaza.
 */
public final class PublicReservationTimeRange {
  private PublicReservationTimeRange() {}

  /** Intervalo del mismo día local, como en HU-6.02. */
  public static ReservationTimeRange resolve(LocalDate date, LocalTime start, LocalTime end, ZoneId zone) {
    return resolve(date, start, null, end, zone, false);
  }

  public static ReservationTimeRange resolve(
      LocalDate date,
      LocalTime start,
      @Nullable LocalDate endDate,
      LocalTime end,
      ZoneId zone,
      boolean allowsOvernight) {
    LocalDate endDay = endDate != null ? endDate : implicitEndDay(date, start, end, allowsOvernight);
    var from = ZonedDateTime.of(date, start, zone);
    var to = ZonedDateTime.of(endDay, end, zone);
    if (!from.isBefore(to)) throw new IllegalArgumentException("El inicio de la reserva debe ser anterior al fin");
    if (!from.toLocalDate().equals(date) || !to.toLocalDate().equals(endDay)
        || !from.toLocalTime().equals(start) || !to.toLocalTime().equals(end)) {
      throw new IllegalArgumentException("El horario local no existe en la zona del establecimiento");
    }
    return ReservationTimeRange.of(from.toInstant(), to.toInstant());
  }

  private static LocalDate implicitEndDay(
      LocalDate date, LocalTime start, LocalTime end, boolean allowsOvernight) {
    if (start.isBefore(end)) return date;
    if (allowsOvernight) return date.plusDays(1);
    throw new IllegalArgumentException("El inicio de la reserva debe ser anterior al fin");
  }
}
