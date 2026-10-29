package com.mapit.reservations.domain.reservation;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class PublicReservationTimeRange {
  private PublicReservationTimeRange() {}
  public static ReservationTimeRange resolve(LocalDate date, LocalTime start, LocalTime end, ZoneId zone) {
    var from = ZonedDateTime.of(date, start, zone);
    var to = ZonedDateTime.of(date, end, zone);
    if (!start.isBefore(end)) throw new IllegalArgumentException("El inicio de la reserva debe ser anterior al fin");
    if (!from.toLocalDate().equals(date) || !to.toLocalDate().equals(date)
        || !from.toLocalTime().equals(start) || !to.toLocalTime().equals(end)) {
      throw new IllegalArgumentException("El horario local no existe en la zona del establecimiento");
    }
    return ReservationTimeRange.of(from.toInstant(), to.toInstant());
  }
}
