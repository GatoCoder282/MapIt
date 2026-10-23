package com.mapit.reservations.domain.availability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.reservation.ReservationResource;

class PublicAvailabilityTest {

  @Test
  void copiesTheResultListToKeepThePublicProjectionImmutable() {
    List<PublicAvailabilityElement> elements = new ArrayList<>();
    elements.add(
        new PublicAvailabilityElement(
            UUID.randomUUID(), ReservationResource.Kind.TABLE));

    PublicAvailability availability =
        new PublicAvailability(UUID.randomUUID(), LocalDate.parse("2026-10-25"), elements);
    elements.clear();

    assertThat(availability.elements()).hasSize(1);
  }

  @Test
  void rejectsDecorFromThePublicAvailabilityProjection() {
    assertThatThrownBy(
            () ->
                new PublicAvailabilityElement(UUID.randomUUID(), ReservationResource.Kind.DECOR))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
