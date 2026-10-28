package com.mapit.reservations.application.availability;

import java.time.LocalDate;
import java.time.LocalTime;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.availability.PublicAvailabilityMap;
import com.mapit.reservations.domain.availability.PublicAvailabilityMapRepository;

@Service
public class FindPublicAvailabilityMap {
  private final PublicAvailabilityMapRepository repository;
  public FindPublicAvailabilityMap(PublicAvailabilityMapRepository repository) { this.repository = repository; }
  @Transactional(readOnly = true)
  public PublicAvailabilityMap execute(String tenant, String establishment, LocalDate date,
      @Nullable LocalTime start, @Nullable LocalTime end) {
    if (date == null || (start == null) != (end == null)) throw new IllegalArgumentException("Se requieren ambos horarios o ninguno");
    return repository.find(tenant, establishment, date, start, end).orElseThrow(PublicAvailabilityNotFoundException::new);
  }
}
