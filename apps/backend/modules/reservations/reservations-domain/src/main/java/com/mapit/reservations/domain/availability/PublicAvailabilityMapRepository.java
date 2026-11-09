package com.mapit.reservations.domain.availability;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

public interface PublicAvailabilityMapRepository {
  /**
   * @param endDate día local de fin (salida de hotel); nulo = mismo día, o el siguiente si la
   *     vertical admite noches y {@code endTime ≤ startTime} (HU-7.01/7.02)
   */
  Optional<PublicAvailabilityMap> find(String tenantSlug, String establishmentSlug, LocalDate date,
      @Nullable LocalTime startTime, @Nullable LocalDate endDate, @Nullable LocalTime endTime);
}
