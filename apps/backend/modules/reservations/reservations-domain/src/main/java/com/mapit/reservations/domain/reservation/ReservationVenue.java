package com.mapit.reservations.domain.reservation;

import java.time.ZoneId;
import java.util.Objects;

import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.shared.vertical.VerticalProfile;

/**
 * Lo que la reserva necesita saber del establecimiento: su vertical operativa
 * ({@code establishment.type}) y su zona horaria (HU-7.01/7.02).
 */
public record ReservationVenue(String vertical, String timezone) {

  public ReservationVenue {
    Objects.requireNonNull(vertical, "vertical no puede ser null");
    Objects.requireNonNull(timezone, "timezone no puede ser null");
  }

  public VerticalProfile profile() {
    return VerticalCatalog.of(vertical);
  }

  public ZoneId zone() {
    return ZoneId.of(timezone);
  }
}
