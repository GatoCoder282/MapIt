package com.mapit.reservations.domain.reservation;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.vertical.VerticalProfile;

/** Proyección mínima de un elemento espacial necesaria para crear una reserva. */
public record ReservationResource(
    UUID id, UUID establishmentId, Kind kind, OperationalState operationalState) {

  public ReservationResource {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(kind, "kind no puede ser null");
    Objects.requireNonNull(operationalState, "operationalState no puede ser null");
  }

  /**
   * Regla mínima válida en cualquier vertical: la decoración nunca se reserva. La usan los
   * flujos posteriores a la creación (pago, llegada) como comprobación defensiva.
   */
  public boolean isReservable() {
    return kind != Kind.DECOR;
  }

  /** HU-7.01/7.02: si la vertical del establecimiento permite reservar este tipo. */
  public boolean isReservableIn(VerticalProfile profile) {
    return profile.isReservable(kind.name());
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
