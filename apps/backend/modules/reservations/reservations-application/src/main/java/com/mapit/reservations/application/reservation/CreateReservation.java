package com.mapit.reservations.application.reservation;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Coordina la creación atómica de una reserva interna. */
@Service
public class CreateReservation {

  private final PersonRepository people;
  private final ReservationResourceRepository resources;
  private final ReservationConcurrencyGuard concurrencyGuard;
  private final ReservationAvailabilityRepository availability;
  private final ReservationRepository reservations;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public CreateReservation(
      PersonRepository people,
      ReservationResourceRepository resources,
      ReservationConcurrencyGuard concurrencyGuard,
      ReservationAvailabilityRepository availability,
      ReservationRepository reservations,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.people = people;
    this.resources = resources;
    this.concurrencyGuard = concurrencyGuard;
    this.availability = availability;
    this.reservations = reservations;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.clock = clock;
  }

  @Transactional
  public Reservation execute(Command command) {
    Objects.requireNonNull(command, "command no puede ser null");
    TenantId tenantId = tenantContext.require();

    Reservation reservation =
        Reservation.create(
            ReservationId.generate(),
            tenantId,
            command.establishmentId(),
            PersonId.of(command.personId()),
            command.spaceElementIds(),
            ReservationTimeRange.of(command.startsAt(), command.endsAt()),
            clock.instant(),
            actorContext.requireUserId());

    requirePerson(tenantId, reservation.personId());
    requireEstablishment(tenantId, reservation.establishmentId());
    requireValidResources(tenantId, reservation);
    concurrencyGuard.lockResources(tenantId, reservation.spaceElementIds());
    requireAvailability(tenantId, reservation);

    return reservations.save(reservation);
  }

  private void requirePerson(TenantId tenantId, PersonId personId) {
    people
        .findAliveById(tenantId, personId.value())
        .orElseThrow(
            () ->
                new ReservationReferenceNotFoundException(
                    ReservationReferenceNotFoundException.Reference.PERSON, personId.value()));
  }

  private void requireEstablishment(TenantId tenantId, UUID establishmentId) {
    if (!resources.establishmentExists(tenantId, establishmentId)) {
      throw new ReservationReferenceNotFoundException(
          ReservationReferenceNotFoundException.Reference.ESTABLISHMENT, establishmentId);
    }
  }

  private void requireValidResources(TenantId tenantId, Reservation reservation) {
    List<ReservationResource> found =
        resources.findAliveByIds(tenantId, reservation.spaceElementIds());
    Set<UUID> foundIds = new HashSet<>();
    for (ReservationResource resource : found) {
      foundIds.add(resource.id());
      if (!resource.establishmentId().equals(reservation.establishmentId())) {
        throw InvalidReservationResourceException.differentEstablishment(
            resource.id(), reservation.establishmentId());
      }
      if (!resource.isActive()) {
        throw InvalidReservationResourceException.notActive(resource.id());
      }
      if (!resource.isReservable()) {
        throw InvalidReservationResourceException.notReservable(resource.id());
      }
    }
    reservation.spaceElementIds().stream()
        .filter(id -> !foundIds.contains(id))
        .findFirst()
        .ifPresent(
            id -> {
              throw new ReservationReferenceNotFoundException(
                  ReservationReferenceNotFoundException.Reference.ELEMENT, id);
            });
  }

  private void requireAvailability(TenantId tenantId, Reservation reservation) {
    Set<UUID> conflicts =
        availability.findConflictingElementIds(
            tenantId, reservation.spaceElementIds(), reservation.timeRange());
    if (!conflicts.isEmpty()) {
      throw new ReservationOverlapException(conflicts);
    }
  }

  public record Command(
      UUID establishmentId,
      UUID personId,
      List<UUID> spaceElementIds,
      Instant startsAt,
      Instant endsAt) {

    public Command {
      Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
      Objects.requireNonNull(personId, "personId no puede ser null");
      Objects.requireNonNull(spaceElementIds, "spaceElementIds no puede ser null");
      Objects.requireNonNull(startsAt, "startsAt no puede ser null");
      Objects.requireNonNull(endsAt, "endsAt no puede ser null");
      spaceElementIds = List.copyOf(spaceElementIds);
    }
  }
}
