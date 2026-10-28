package com.mapit.reservations.application.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class CreatePublicReservationTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT = UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final Instant NOW = Instant.parse("2026-10-20T12:00:00Z");

  private FakePublicEstablishments establishments;
  private FakePeople people;
  private FakeReservations reservations;
  private CreatePublicReservation useCase;

  @BeforeEach
  void setUp() {
    establishments =
        new FakePublicEstablishments(
            new PublicEstablishment(TENANT, ESTABLISHMENT, "America/La_Paz"));
    people = new FakePeople();
    FakeResources resources = new FakeResources();
    FakeConcurrencyGuard guard = new FakeConcurrencyGuard();
    FakeAvailability availability = new FakeAvailability();
    reservations = new FakeReservations();
    Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    TenantContext tenantContext = () -> Optional.of(TENANT);
    ActorContext actorContext = () -> Optional.of(ACTOR);
    CreateReservation createReservation =
        new CreateReservation(
            people, resources, guard, availability, reservations, tenantContext, actorContext, clock);
    useCase = new CreatePublicReservation(establishments, people, createReservation, clock,
        new PublicReservationAccessService(new ReservationAccessTestRepository(), establishments, guard, resources, clock));
  }

  @Test
  void creaLaReservaPublicaConHoraLocalConvertidaYAuditoriaAnonima() {
    CreatePublicReservation.Result result =
        useCase.execute(
            new CreatePublicReservation.Command(
                "demo",
                "la-bahia",
                LocalDate.parse("2026-10-25"),
                LocalTime.parse("19:00"),
                LocalTime.parse("21:00"),
                List.of(ELEMENT),
                new CreatePublicReservation.Customer(
                    "  Ana Pérez  ", " ANA@Example.COM ", " +591 70000000 ")));

    Reservation reservation = result.reservation();
    assertThat(reservation.tenantId()).isEqualTo(TENANT);
    assertThat(reservation.establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(reservation.spaceElementIds()).containsExactly(ELEMENT);
    assertThat(reservation.timeRange().startsAt())
        .isEqualTo(Instant.parse("2026-10-25T23:00:00Z"));
    assertThat(reservation.timeRange().endsAt()).isEqualTo(Instant.parse("2026-10-26T01:00:00Z"));
    assertThat(reservation.createdBy()).isNull();
    assertThat(people.created.fullName()).isEqualTo("Ana Pérez");
    assertThat(people.created.email()).isEqualTo("ana@example.com");
    assertThat(people.created.phone()).isEqualTo("+591 70000000");
    assertThat(people.created.createdBy()).isNull();
    assertThat(people.created.updatedBy()).isNull();
    assertThat(result.establishment().timezone()).isEqualTo("America/La_Paz");
    assertThat(result.access().token()).matches("[A-Za-z0-9_-]{43}");
    assertThat(result.access().expiresAt()).isEqualTo(Instant.parse("2026-10-27T01:00:00Z"));
    assertThat(reservations.saved).isSameAs(reservation);
  }

  @Test
  void rechazaUnaFechaPasadaAntesDeRegistrarLaPersona() {
    assertThatThrownBy(() -> useCase.execute(new CreatePublicReservation.Command(
        "demo", "la-bahia", LocalDate.parse("2026-10-19"), LocalTime.parse("19:00"),
        LocalTime.parse("21:00"), List.of(ELEMENT),
        new CreatePublicReservation.Customer("Ana Pérez", "ana@example.com", null))))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("futuro");
    assertThat(people.created).isNull();
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaUnEstablecimientoInexistenteAntesDeCrearLaPersona() {
    establishments.found = false;

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new CreatePublicReservation.Command(
                        "demo",
                        "no-existe",
                        LocalDate.parse("2026-10-25"),
                        LocalTime.parse("19:00"),
                        LocalTime.parse("21:00"),
                        List.of(ELEMENT),
                        new CreatePublicReservation.Customer(
                            "Ana Pérez", "ana@example.com", null))))
        .isInstanceOf(PublicEstablishmentNotFoundException.class);
    assertThat(people.created).isNull();
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaUnIntervaloInvertidoAntesDeCrearLaPersona() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new CreatePublicReservation.Command(
                        "demo",
                        "la-bahia",
                        LocalDate.parse("2026-10-25"),
                        LocalTime.parse("21:00"),
                        LocalTime.parse("19:00"),
                        List.of(ELEMENT),
                        new CreatePublicReservation.Customer(
                            "Ana Pérez", "ana@example.com", null))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("anterior");
    assertThat(people.created).isNull();
  }

  private static final class FakePublicEstablishments implements PublicReservationRepository {
    private final PublicEstablishment establishment;
    private boolean found = true;

    private FakePublicEstablishments(PublicEstablishment establishment) {
      this.establishment = establishment;
    }

    @Override
    public Optional<PublicEstablishment> findActiveEstablishment(
        String tenantSlug, String establishmentSlug) {
      return found ? Optional.of(establishment) : Optional.empty();
    }
  }

  private static final class FakePeople implements PersonRepository {
    private @Nullable Person created;

    @Override
    public List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery) {
      return List.of();
    }

    @Override
    public Optional<Person> findAliveById(TenantId tenantId, UUID id) {
      return Optional.ofNullable(created)
          .filter(person -> person.tenantId().equals(tenantId))
          .filter(person -> person.id().value().equals(id));
    }

    @Override
    public Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail) {
      return Optional.empty();
    }

    @Override
    public Person insert(Person person) {
      created = person;
      return person;
    }

    @Override
    public Person findOrCreatePublic(Person person) {
      return insert(person);
    }
  }

  private static final class FakeResources implements ReservationResourceRepository {
    @Override
    public boolean establishmentExists(TenantId tenantId, UUID establishmentId) {
      return true;
    }

    @Override
    public List<ReservationResource> findAliveByIds(
        TenantId tenantId, Collection<UUID> elementIds) {
      return List.of(
          new ReservationResource(
              ELEMENT,
              ESTABLISHMENT,
              ReservationResource.Kind.TABLE,
              ReservationResource.OperationalState.AVAILABLE));
    }
  }

  private static final class FakeAvailability implements ReservationAvailabilityRepository {
    @Override
    public Set<UUID> findConflictingElementIds(
        TenantId tenantId, Set<UUID> elementIds, ReservationTimeRange timeRange) {
      return Set.of();
    }
  }

  private static final class FakeConcurrencyGuard implements ReservationConcurrencyGuard {
    @Override
    public void lockResources(TenantId tenantId, Set<UUID> elementIds) {}
  }

  private static final class FakeReservations implements ReservationRepository {

    private @Nullable Reservation saved;

    @Override
    public Reservation save(Reservation reservation) {
      saved = reservation;
      return reservation;
    }

    @Override
    public java.util.List<Reservation> findAll(com.mapit.shared.tenant.TenantId tenantId) {
      return java.util.List.of();
    }
  }
}
