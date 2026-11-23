package com.mapit.reservations.domain.reservation;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.vertical.Vertical;

public final class PublicReservationTimeRange {
  private static final int RESTAURANT_DURATION_MINUTES = 90;

  private PublicReservationTimeRange() {}

  public static ReservationTimeRange resolve(
      LocalDate date, LocalTime start, @Nullable LocalTime end, ZoneId zone, String establishmentType) {
    var from = localTime(date, start, zone).toInstant();
    if (end == null) {
      if (!Vertical.RESTAURANT.name().equals(establishmentType)) {
        throw new IllegalArgumentException("Se requiere la hora de fin");
      }
      var range = ReservationTimeRange.of(from, from.plus(RESTAURANT_DURATION_MINUTES, ChronoUnit.MINUTES));
      ReservationResource.validateBookingRange(range, Vertical.RESTAURANT, zone);
      return range;
    }
    if (!start.isBefore(end)) {
      throw new IllegalArgumentException("El inicio de la reserva debe ser anterior al fin");
    }
    return ReservationTimeRange.of(from, localTime(date, end, zone).toInstant());
  }

  private static ZonedDateTime localTime(LocalDate date, LocalTime time, ZoneId zone) {
    var value = ZonedDateTime.of(date, time, zone);
    if (!value.toLocalDate().equals(date) || !value.toLocalTime().equals(time)) {
      throw new IllegalArgumentException("El horario local no existe en la zona del establecimiento");
    }
    return value;
  }
}
