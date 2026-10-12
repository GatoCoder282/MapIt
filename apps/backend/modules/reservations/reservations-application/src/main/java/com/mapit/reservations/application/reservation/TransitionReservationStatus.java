package com.mapit.reservations.application.reservation;

import java.time.Clock;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Valida y persiste una transición del ciclo de vida de una reserva. */
@Service
public class TransitionReservationStatus {

  private final ReservationRepository reservations;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public TransitionReservationStatus(
      ReservationRepository reservations,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.reservations = reservations;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.clock = clock;
  }

  @Transactional
  public Reservation execute(Command command) {
    Objects.requireNonNull(command, "command no puede ser null");
    TenantId tenantId = tenantContext.require();
    ReservationId reservationId = ReservationId.of(command.reservationId());
    Reservation current =
        reservations
            .findAliveByTenantAndEstablishmentAndId(
                tenantId, command.establishmentId(), reservationId)
            .orElseThrow(
                () ->
                    new ReservationReferenceNotFoundException(
                        ReservationReferenceNotFoundException.Reference.RESERVATION,
                        reservationId.value()));

    Reservation updated = current.transitionTo(command.status());
    if (!reservations.updateStatus(
        tenantId,
        command.establishmentId(),
        reservationId,
        current.status(),
        updated.status(),
        actorContext.requireUserId(),
        clock.instant())) {
      throw new ReservationStatusUpdateConflictException();
    }
    return updated;
  }

  public record Command(UUID establishmentId, UUID reservationId, ReservationStatus status) {
    public Command {
      Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
      Objects.requireNonNull(reservationId, "reservationId no puede ser null");
      Objects.requireNonNull(status, "status no puede ser null");
    }
  }
}
