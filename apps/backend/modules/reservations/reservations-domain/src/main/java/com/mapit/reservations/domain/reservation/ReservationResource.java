package com.mapit.reservations.domain.reservation;

import java.util.Objects;
import java.util.UUID;

/** Proyección mínima de un elemento espacial necesaria para crear una reserva. */
public record ReservationResource(
    UUID id, UUID establishmentId, Kind kind, OperationalState operationalState) {

  public ReservationResource {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(kind, "kind no puede ser null");
    Objects.requireNonNull(operationalState, "operationalState no puede ser null");
  }

  /** Hasta CU-07, solo DECOR expresa de forma explícita que no admite reservas. */
  public boolean isReservable() {
    return kind != Kind.DECOR;
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
