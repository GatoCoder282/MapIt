package com.mapit.reservations.domain.reservation;

import java.time.Instant;
import java.util.Objects;

/** Intervalo semiabierto {@code [startsAt, endsAt)} ocupado por una reserva. */
public record ReservationTimeRange(Instant startsAt, Instant endsAt) {

  public ReservationTimeRange {
    Objects.requireNonNull(startsAt, "startsAt no puede ser null");
    Objects.requireNonNull(endsAt, "endsAt no puede ser null");
    if (!startsAt.isBefore(endsAt)) {
      throw new IllegalArgumentException("El inicio de la reserva debe ser anterior al fin");
    }
  }

  public static ReservationTimeRange of(Instant startsAt, Instant endsAt) {
    return new ReservationTimeRange(startsAt, endsAt);
  }

  /**
   * Indica si dos intervalos comparten tiempo. Al ser semiabiertos, que uno termine
   * exactamente cuando comienza el otro no constituye solapamiento.
   */
  public boolean overlaps(ReservationTimeRange other) {
    Objects.requireNonNull(other, "other no puede ser null");
    return startsAt.isBefore(other.endsAt) && other.startsAt.isBefore(endsAt);
  }
}
