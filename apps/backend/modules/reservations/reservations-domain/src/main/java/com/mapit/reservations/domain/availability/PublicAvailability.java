package com.mapit.reservations.domain.availability;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Resultado público de disponibilidad para el día local solicitado. */
public record PublicAvailability(
    UUID establishmentId, LocalDate date, List<PublicAvailabilityElement> elements) {

  public PublicAvailability {
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(date, "date no puede ser null");
    Objects.requireNonNull(elements, "elements no puede ser null");
    elements = List.copyOf(elements);
  }
}
