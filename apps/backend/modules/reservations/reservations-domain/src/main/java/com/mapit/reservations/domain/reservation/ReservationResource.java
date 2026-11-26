package com.mapit.reservations.domain.reservation;

import java.time.Duration;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.vertical.BookingMode;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalCatalog;

/** Proyección mínima de un elemento espacial necesaria para crear una reserva. */
public record ReservationResource(
    UUID id, UUID establishmentId, Kind kind, OperationalState operationalState,
    @Nullable Integer capacity, @Nullable Vertical vertical, @Nullable String timezone) {

  public ReservationResource(UUID id, UUID establishmentId, Kind kind, OperationalState operationalState) {
    this(id, establishmentId, kind, operationalState, null, null, null);
  }

  public ReservationResource(UUID id, UUID establishmentId, Kind kind,
      OperationalState operationalState, @Nullable Integer capacity) {
    this(id, establishmentId, kind, operationalState, capacity, null, null);
  }

  public ReservationResource {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(kind, "kind no puede ser null");
    Objects.requireNonNull(operationalState, "operationalState no puede ser null");
    if (vertical != null) ZoneId.of(Objects.requireNonNull(timezone, "timezone no puede ser null"));
  }

  /** La disponibilidad comercial procede del catálogo, no del estado operativo. */
  public boolean isReservable() {
    if (vertical != null) return VerticalCatalog.of(vertical).isReservable(kind.name());
    return Arrays.stream(Vertical.values())
        .anyMatch(candidate -> VerticalCatalog.of(candidate).isReservable(kind.name()));
  }

  public void validateBookingRange(ReservationTimeRange range) {
    if (vertical == null) return;
    validateBookingRange(range, vertical, ZoneId.of(Objects.requireNonNull(timezone)));
  }

  static void validateBookingRange(ReservationTimeRange range, Vertical vertical, ZoneId zone) {
    var profile = VerticalCatalog.of(vertical);
    var startDate = range.startsAt().atZone(zone).toLocalDate();
    var endDate = range.endsAt().atZone(zone).toLocalDate();
    if (profile.bookingMode() == BookingMode.STAY) {
      long nights = ChronoUnit.DAYS.between(startDate, endDate);
      if (nights < Objects.requireNonNull(profile.minNights())
          || nights > Objects.requireNonNull(profile.maxNights())) {
        throw new IllegalArgumentException("La estadía debe respetar el rango de noches de la vertical");
      }
    } else if (Duration.between(range.startsAt(), range.endsAt())
        .compareTo(Objects.requireNonNull(profile.maxDuration())) > 0
        || (!profile.allowsOvernight() && !startDate.equals(endDate))) {
      throw new IllegalArgumentException("El horario excede la ventana de reserva de la vertical");
    }
  }

  public boolean isActive() {
    return operationalState != OperationalState.OUT_OF_SERVICE;
  }

  public enum Kind {
    TABLE,
    BAR,
    SECTOR_ZONE,
    STAGE,
    SEAT,
    ROOM,
    DECOR
  }

  public enum OperationalState {
    AVAILABLE,
    OCCUPIED,
    RESERVED,
    CLEANING,
    OUT_OF_SERVICE
  }
}
