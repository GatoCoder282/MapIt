package com.mapit.reservations.application.reservation;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.reservations.domain.reservation.Reservation;

/** Crea una reserva anónima desde el portal público resolviendo tenant y establecimiento por slug. */
@Service
public class CreatePublicReservation {

  private final PublicReservationRepository publicEstablishments;
  private final PersonRepository people;
  private final CreateReservation createReservation;
  private final Clock clock;
  private final PublicReservationAccessService access;

  public CreatePublicReservation(
      PublicReservationRepository publicEstablishments,
      PersonRepository people,
      CreateReservation createReservation,
      Clock clock,
      PublicReservationAccessService access) {
    this.publicEstablishments = publicEstablishments;
    this.people = people;
    this.createReservation = createReservation;
    this.clock = clock;
    this.access = access;
  }

  @Transactional
  public Result execute(Command command) {
    Objects.requireNonNull(command, "command no puede ser null");

    PublicEstablishment establishment =
        publicEstablishments
            .findActiveEstablishment(command.tenantSlug(), command.establishmentSlug())
            .orElseThrow(PublicEstablishmentNotFoundException::new);

    ZoneId zone = ZoneId.of(establishment.timezone());
    var range = com.mapit.reservations.domain.reservation.PublicReservationTimeRange.resolve(command.date(), command.startTime(), command.endTime(), zone);
    Instant startsAt = range.startsAt();
    Instant endsAt = range.endsAt();
    if (!startsAt.isAfter(clock.instant())) {
      throw new IllegalArgumentException("La reserva pública debe comenzar en el futuro");
    }

    Person candidate =
        Person.register(
            PersonId.generate(),
            establishment.tenantId(),
            command.customer().fullName(),
            command.customer().email(),
            command.customer().phone(),
            clock.instant(),
            null);
    Person person = people.findOrCreatePublic(candidate);

    Reservation reservation =
        createReservation.create(
            establishment.tenantId(),
            null,
            establishment.id(),
            person.id(),
            command.spaceElementIds(),
            startsAt,
            endsAt,
            true);

    return new Result(
        reservation,
        establishment,
        command.date(),
        command.startTime(),
        command.endTime(),
        access.issue(reservation));
  }

  public record Command(
      String tenantSlug,
      String establishmentSlug,
      LocalDate date,
      LocalTime startTime,
      LocalTime endTime,
      List<UUID> spaceElementIds,
      Customer customer) {

    public Command {
      Objects.requireNonNull(tenantSlug, "tenantSlug no puede ser null");
      Objects.requireNonNull(establishmentSlug, "establishmentSlug no puede ser null");
      Objects.requireNonNull(date, "date no puede ser null");
      Objects.requireNonNull(startTime, "startTime no puede ser null");
      Objects.requireNonNull(endTime, "endTime no puede ser null");
      Objects.requireNonNull(spaceElementIds, "spaceElementIds no puede ser null");
      Objects.requireNonNull(customer, "customer no puede ser null");
      spaceElementIds = List.copyOf(spaceElementIds);
    }
  }

  public record Customer(String fullName, String email, @Nullable String phone) {

    public Customer {
      Objects.requireNonNull(fullName, "fullName no puede ser null");
      Objects.requireNonNull(email, "email no puede ser null");
    }
  }

  public record Result(
      Reservation reservation,
      PublicEstablishment establishment,
      LocalDate date,
      LocalTime startTime,
      LocalTime endTime,
      PublicReservationAccessService.IssuedAccess access) {}
}
