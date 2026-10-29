package com.mapit.reservations.domain.availability;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

public interface PublicAvailabilityMapRepository {
  Optional<PublicAvailabilityMap> find(String tenantSlug, String establishmentSlug, LocalDate date,
      @Nullable LocalTime startTime, @Nullable LocalTime endTime);
}
