package com.mapit.reservations.application.availability;

import java.time.LocalDate;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.availability.PublicAvailability;
import com.mapit.reservations.domain.availability.PublicAvailabilityRepository;

/** Consulta los elementos publicables y reservables de un establecimiento para un día. */
@Service
public class FindPublicAvailability {

  private final PublicAvailabilityRepository availability;

  public FindPublicAvailability(PublicAvailabilityRepository availability) {
    this.availability = availability;
  }

  @Transactional(readOnly = true)
  public PublicAvailability execute(Query query) {
    Objects.requireNonNull(query, "query no puede ser null");
    return availability
        .findBySlugsAndDate(query.tenantSlug(), query.establishmentSlug(), query.date())
        .orElseThrow(PublicAvailabilityNotFoundException::new);
  }

  public record Query(String tenantSlug, String establishmentSlug, LocalDate date) {

    public Query {
      Objects.requireNonNull(tenantSlug, "tenantSlug no puede ser null");
      Objects.requireNonNull(establishmentSlug, "establishmentSlug no puede ser null");
      Objects.requireNonNull(date, "date no puede ser null");
    }
  }
}
