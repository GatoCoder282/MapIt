package com.mapit.reservations.application.availability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.availability.PublicAvailability;
import com.mapit.reservations.domain.availability.PublicAvailabilityElement;
import com.mapit.reservations.domain.availability.PublicAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;

class FindPublicAvailabilityTest {

  private static final String TENANT_SLUG = "tenant-a";
  private static final String ESTABLISHMENT_SLUG = "venue-a";
  private static final LocalDate DATE = LocalDate.parse("2026-10-25");
  private static final UUID ESTABLISHMENT_ID =
      UUID.fromString("61000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_ID = UUID.fromString("61000000-0000-0000-0000-000000000002");

  private PublicAvailabilityRepository repository;
  private FindPublicAvailability useCase;
  private Optional<PublicAvailability> repositoryResult;
  private String observedTenantSlug;
  private String observedEstablishmentSlug;
  private LocalDate observedDate;

  @BeforeEach
  void setUp() {
    repositoryResult = Optional.empty();
    repository =
        (tenantSlug, establishmentSlug, date) -> {
          observedTenantSlug = tenantSlug;
          observedEstablishmentSlug = establishmentSlug;
          observedDate = date;
          return repositoryResult;
        };
    useCase = new FindPublicAvailability(repository);
  }

  @Test
  void returnsTheRepositoryProjectionForTheRequestedSlugsAndDay() {
    PublicAvailability expected =
        new PublicAvailability(
            ESTABLISHMENT_ID,
            DATE,
            List.of(new PublicAvailabilityElement(ELEMENT_ID, ReservationResource.Kind.TABLE)));
    repositoryResult = Optional.of(expected);

    PublicAvailability result =
        useCase.execute(new FindPublicAvailability.Query(TENANT_SLUG, ESTABLISHMENT_SLUG, DATE));

    assertThat(result).isEqualTo(expected);
    assertThat(observedTenantSlug).isEqualTo(TENANT_SLUG);
    assertThat(observedEstablishmentSlug).isEqualTo(ESTABLISHMENT_SLUG);
    assertThat(observedDate).isEqualTo(DATE);
  }

  @Test
  void mapsMissingTenantOrEstablishmentToOnePublicNotFoundError() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new FindPublicAvailability.Query(TENANT_SLUG, ESTABLISHMENT_SLUG, DATE)))
        .isInstanceOf(PublicAvailabilityNotFoundException.class)
        .hasMessage("El tenant o el establecimiento no están disponibles.");
  }
}
