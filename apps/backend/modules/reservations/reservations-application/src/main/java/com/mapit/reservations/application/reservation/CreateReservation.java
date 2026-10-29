package com.mapit.reservations.application.reservation;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.reservations.domain.reservation.BookingWindow;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.reservations.domain.reservation.ReservationVenue;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalGate;
import com.mapit.shared.vertical.VerticalProfile;

/**
 * Coordina la creación atómica de una reserva, interna o pública.
 *
 * <p>HU-7.01/7.02: es el único servicio de reservas para las cuatro verticales. La vertical del
 * establecimiento decide si está habilitada (Unleash), qué ventana temporal se admite
 * ({@link BookingWindow}) y qué elementos son reservables; el resto del flujo —bloqueo,
 * solapamiento 409, persistencia y auditoría— es común.
 */
@Service
public class CreateReservation {

  private final PersonRepository people;
  private final ReservationResourceRepository resources;
  private final ReservationConcurrencyGuard concurrencyGuard;
  private final ReservationAvailabilityRepository availability;
  private final ReservationRepository reservations;
  private final AuditEventRecorder auditEvents;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;
  private final VerticalGate verticalGate;

  public CreateReservation(
      PersonRepository people,
      ReservationResourceRepository resources,
      ReservationConcurrencyGuard concurrencyGuard,
      ReservationAvailabilityRepository availability,
      ReservationRepository reservations,
      AuditEventRecorder auditEvents,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock,
      VerticalGate verticalGate) {
    this.people = people;
    this.resources = resources;
    this.concurrencyGuard = concurrencyGuard;
    this.availability = availability;
    this.reservations = reservations;
    this.auditEvents = auditEvents;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.clock = clock;
    this.verticalGate = verticalGate;
  }

  @Transactional
  public Reservation execute(Command command) {
    Objects.requireNonNull(command, "command no puede ser null");
    return create(
        tenantContext.require(),
        actorContext.requireUserId(),
        command.establishmentId(),
        PersonId.of(command.personId()),
        command.spaceElementIds(),
        command.startsAt(),
        command.endsAt(),
        false);
  }

  /**
   * Crea una reserva para un tenant explícito. El flujo público usa {@code createdBy = null} y
   * exige que los elementos sigan operativamente disponibles.
   */
  @Transactional
  public Reservation create(
      TenantId tenantId,
      @Nullable UUID createdBy,
      UUID establishmentId,
      PersonId personId,
      Collection<UUID> spaceElementIds,
      Instant startsAt,
      Instant endsAt,
      boolean requireAvailableState) {
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");

    Reservation reservation =
        Reservation.create(
            ReservationId.generate(),
            tenantId,
            establishmentId,
            personId,
            spaceElementIds,
            ReservationTimeRange.of(startsAt, endsAt),
            clock.instant(),
            createdBy);

    requirePerson(tenantId, reservation.personId());
    ReservationVenue venue = requireEstablishment(tenantId, reservation.establishmentId());
    VerticalProfile profile = venue.profile();
    verticalGate.require(Vertical.of(venue.vertical()), tenantId);
    BookingWindow.of(profile).validate(reservation.timeRange(), venue.zone());
    concurrencyGuard.lockResources(tenantId, reservation.spaceElementIds());
    requireValidResources(tenantId, reservation, profile, requireAvailableState);
    requireAvailability(tenantId, reservation);

    Reservation persisted = reservations.save(reservation);
    if (persisted.createdBy() != null) {
      auditEvents.record(
          new AuditEvent(
              UUID.randomUUID(),
              tenantId,
              persisted.createdBy(),
              persisted.createdAt(),
              AuditResourceType.RESERVATION,
              persisted.id().value(),
              AuditEventType.RESERVATION_CREATED,
              java.util.Map.of(
                  "status", persisted.status().name(),
                  "establishmentId", persisted.establishmentId().toString())));
    }
    return persisted;
  }

  private void requirePerson(TenantId tenantId, PersonId personId) {
    people
        .findAliveById(tenantId, personId.value())
        .orElseThrow(
            () ->
                new ReservationReferenceNotFoundException(
                    ReservationReferenceNotFoundException.Reference.PERSON, personId.value()));
  }

  private ReservationVenue requireEstablishment(TenantId tenantId, UUID establishmentId) {
    return resources
        .findVenue(tenantId, establishmentId)
        .orElseThrow(
            () ->
                new ReservationReferenceNotFoundException(
                    ReservationReferenceNotFoundException.Reference.ESTABLISHMENT,
                    establishmentId));
  }

  private void requireValidResources(
      TenantId tenantId,
      Reservation reservation,
      VerticalProfile profile,
      boolean requireAvailableState) {
    List<ReservationResource> found =
        resources.findAliveByIds(tenantId, reservation.spaceElementIds());
    Set<UUID> foundIds = new HashSet<>();
    Set<UUID> unavailable = new LinkedHashSet<>();
    for (ReservationResource resource : found) {
      foundIds.add(resource.id());
      if (!resource.establishmentId().equals(reservation.establishmentId())) {
        throw InvalidReservationResourceException.differentEstablishment(
            resource.id(), reservation.establishmentId());
      }
      if (!resource.isReservableIn(profile)) {
        throw InvalidReservationResourceException.notReservable(resource.id());
      }
      if (requireAvailableState
          && resource.operationalState() != ReservationResource.OperationalState.AVAILABLE) {
        unavailable.add(resource.id());
        continue;
      }
      if (!resource.isActive()) {
        throw InvalidReservationResourceException.notActive(resource.id());
      }
    }
    if (!unavailable.isEmpty()) {
      throw new ReservationResourceUnavailableException(unavailable);
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
