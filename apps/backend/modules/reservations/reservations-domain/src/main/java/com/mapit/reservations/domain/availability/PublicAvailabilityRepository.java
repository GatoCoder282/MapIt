package com.mapit.reservations.domain.availability;

import java.time.LocalDate;
import java.util.Optional;

/** Puerto de lectura pública con resolución del tenant por slug. */
public interface PublicAvailabilityRepository {

  Optional<PublicAvailability> findBySlugsAndDate(
      String tenantSlug, String establishmentSlug, LocalDate date);
}
