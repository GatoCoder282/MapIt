package com.mapit.reservations.domain.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.shared.tenant.TenantId;

class ReservationStatusTransitionTest {

  private static final UUID ESTABLISHMENT = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT = UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID ACTOR = UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final Instant START = Instant.parse("2026-10-03T18:00:00Z");
  private static final ReservationId ID = ReservationId.generate();

  @Test
  void exposesEveryAllowedTransitionFromTheBackendMachine() {
    assertThat(ReservationStatus.CREATED.allowedTransitions())
        .containsExactly(ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED);
    assertThat(ReservationStatus.CONFIRMED.allowedTransitions())
        .containsExactly(ReservationStatus.ACTIVE, ReservationStatus.CANCELLED);
    assertThat(ReservationStatus.ACTIVE.allowedTransitions())
        .containsExactly(ReservationStatus.RELEASED, ReservationStatus.CANCELLED);
    assertThat(ReservationStatus.RELEASED.allowedTransitions()).isEmpty();
    assertThat(ReservationStatus.CANCELLED.allowedTransitions()).isEmpty();
  }

  @Test
  void acceptsExactlyTheAllowedPairsAndRejectsEveryOtherPairIncludingTerminalStates() {
    for (ReservationStatus current : ReservationStatus.values()) {
      for (ReservationStatus requested : ReservationStatus.values()) {
        if (current.canTransitionTo(requested)) {
          Reservation initial = reservation(current);
          Reservation result = initial.transitionTo(requested);
          assertThat(result.status()).isEqualTo(requested);
          assertThat(result).isNotSameAs(initial);
        } else {
          assertThatThrownBy(() -> reservation(current).transitionTo(requested))
              .isInstanceOf(ReservationTransitionNotAllowedException.class)
              .hasMessageContaining(current + " -> " + requested);
        }
      }
    }
  }

  private static Reservation reservation(ReservationStatus status) {
    return new Reservation(
        ID,
        TenantId.of("tenant-a"),
        ESTABLISHMENT,
        PersonId.of(PERSON),
        Set.of(ELEMENT),
        ReservationTimeRange.of(START, START.plusSeconds(3600)),
        status,
        START.minusSeconds(3600),
        ACTOR);
  }
}
