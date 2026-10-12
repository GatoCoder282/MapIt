package com.mapit.reservations.application.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class TransitionReservationStatusTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ACTOR = UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT = UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID RESERVATION_ID = UUID.fromString("50000000-0000-0000-0000-000000000001");
  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

  private FakeReservations reservations;
  private TransitionReservationStatus useCase;

  @BeforeEach
  void setUp() {
    reservations = new FakeReservations();
    reservations.current = reservation(ReservationStatus.CREATED);
    useCase =
        new TransitionReservationStatus(
            reservations,
            (TenantContext) () -> Optional.of(TENANT),
            () -> Optional.of(ACTOR),
            Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  void transitionsAndPersistsUsingAuthenticatedTenantActorAndCurrentStatus() {
    Reservation updated =
        useCase.execute(
            new TransitionReservationStatus.Command(
                ESTABLISHMENT, RESERVATION_ID, ReservationStatus.CONFIRMED));

    assertThat(updated.status()).isEqualTo(ReservationStatus.CONFIRMED);
    assertThat(reservations.updatedTenant).isEqualTo(TENANT);
    assertThat(reservations.updatedEstablishment).isEqualTo(ESTABLISHMENT);
    assertThat(reservations.expectedStatus).isEqualTo(ReservationStatus.CREATED);
    assertThat(reservations.nextStatus).isEqualTo(ReservationStatus.CONFIRMED);
    assertThat(reservations.actorId).isEqualTo(ACTOR);
    assertThat(reservations.updatedAt).isEqualTo(NOW);
  }

  @Test
  void rejectsAnInvalidTransitionBeforeAttemptingPersistence() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new TransitionReservationStatus.Command(
                        ESTABLISHMENT, RESERVATION_ID, ReservationStatus.ACTIVE)))
        .isInstanceOf(
            com.mapit.reservations.domain.reservation.ReservationTransitionNotAllowedException.class);

    assertThat(reservations.updateCalls).isZero();
  }

  @Test
  void returnsNotFoundWhenReservationIsNotInTenantAndEstablishment() {
    reservations.current = null;

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new TransitionReservationStatus.Command(
                        ESTABLISHMENT, RESERVATION_ID, ReservationStatus.CONFIRMED)))
        .isInstanceOf(ReservationReferenceNotFoundException.class);

    assertThat(reservations.updateCalls).isZero();
  }

  @Test
  void reportsConcurrentStateChangeAsConflict() {
    reservations.updateResult = false;

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new TransitionReservationStatus.Command(
                        ESTABLISHMENT, RESERVATION_ID, ReservationStatus.CONFIRMED)))
        .isInstanceOf(ReservationStatusUpdateConflictException.class);
  }

  private static Reservation reservation(ReservationStatus status) {
    return new Reservation(
        ReservationId.of(RESERVATION_ID),
        TENANT,
        ESTABLISHMENT,
        PersonId.of(PERSON),
        Set.of(ELEMENT),
        ReservationTimeRange.of(NOW, NOW.plusSeconds(3600)),
        status,
        NOW.minusSeconds(3600),
        ACTOR);
  }

  private static final class FakeReservations implements ReservationRepository {
    private @Nullable Reservation current;
    private TenantId updatedTenant;
    private UUID updatedEstablishment;
    private ReservationStatus expectedStatus;
    private ReservationStatus nextStatus;
    private UUID actorId;
    private Instant updatedAt;
    private int updateCalls;
    private boolean updateResult = true;

    @Override
    public Reservation save(Reservation reservation) {
      current = reservation;
      return reservation;
    }

    @Override
    public Optional<Reservation> findAliveByTenantAndEstablishmentAndId(
        TenantId tenantId, UUID establishmentId, ReservationId reservationId) {
      return current == null ? Optional.empty() : Optional.of(current);
    }

    @Override
    public boolean updateStatus(
        TenantId tenantId,
        UUID establishmentId,
        ReservationId reservationId,
        ReservationStatus expectedStatus,
        ReservationStatus nextStatus,
        UUID actorId,
        Instant updatedAt) {
      updateCalls++;
      this.updatedTenant = tenantId;
      this.updatedEstablishment = establishmentId;
      this.expectedStatus = expectedStatus;
      this.nextStatus = nextStatus;
      this.actorId = actorId;
      this.updatedAt = updatedAt;
      return updateResult;
    }
  }
}
