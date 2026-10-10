package com.mapit.reservations.application.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class CreateReservationTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID OTHER_ESTABLISHMENT =
      UUID.fromString("30000000-0000-0000-0000-000000000002");
  private static final UUID ELEMENT_A =
      UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_B =
      UUID.fromString("40000000-0000-0000-0000-000000000002");
  private static final Instant STARTS_AT = Instant.parse("2026-10-04T18:00:00Z");
  private static final Instant ENDS_AT = Instant.parse("2026-10-04T20:00:00Z");
  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

  private FakePeople people;
  private FakeResources resources;
  private FakeConcurrencyGuard concurrencyGuard;
  private FakeAvailability availability;
  private FakeReservations reservations;
  private CreateReservation useCase;

  @BeforeEach
  void setUp() {
    people = new FakePeople();
    people.person =
        Person.register(
            PersonId.of(PERSON), TENANT, "Ana Pérez", "ana@example.com", null, NOW, ACTOR);
    resources = new FakeResources();
    resources.found =
        List.of(
            resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE),
            resource(ELEMENT_B, ESTABLISHMENT, ReservationResource.Kind.TABLE));
    concurrencyGuard = new FakeConcurrencyGuard();
    availability = new FakeAvailability();
    reservations = new FakeReservations();
    TenantContext tenantContext = () -> Optional.of(TENANT);
    ActorContext actorContext = () -> Optional.of(ACTOR);
    useCase =
        new CreateReservation(
            people,
            resources,
            concurrencyGuard,
            availability,
            reservations,
            tenantContext,
            actorContext,
            Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  void creaLaReservaCuandoTodasLasReferenciasSonValidasYDisponibles() {
    Reservation created = useCase.execute(validCommand());

    assertThat(created.tenantId()).isEqualTo(TENANT);
    assertThat(created.personId()).isEqualTo(PersonId.of(PERSON));
    assertThat(created.establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(created.spaceElementIds()).containsExactlyInAnyOrder(ELEMENT_A, ELEMENT_B);
    assertThat(created.status()).isEqualTo(ReservationStatus.CREATED);
    assertThat(created.createdAt()).isEqualTo(NOW);
    assertThat(created.createdBy()).isEqualTo(ACTOR);
    assertThat(reservations.saved).isSameAs(created);
    assertThat(concurrencyGuard.lockedIds).containsExactlyInAnyOrder(ELEMENT_A, ELEMENT_B);
  }

  @Test
  void noPersisteCuandoLaPersonaNoPerteneceAlTenant() {
    people.person = null;

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(ReservationReferenceNotFoundException.class)
        .hasMessageContaining("Cliente no encontrado");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void noPersisteCuandoElEstablecimientoNoPerteneceAlTenant() {
    resources.establishmentExists = false;

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(ReservationReferenceNotFoundException.class)
        .hasMessageContaining("Establecimiento no encontrado");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void trataUnElementoAusenteOAjenoComoNoEncontrado() {
    resources.found =
        List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(ReservationReferenceNotFoundException.class)
        .hasMessageContaining("Elemento espacial no encontrado");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaElementosDeOtroEstablecimiento() {
    resources.found =
        List.of(
            resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE),
            resource(ELEMENT_B, OTHER_ESTABLISHMENT, ReservationResource.Kind.TABLE));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(InvalidReservationResourceException.class)
        .hasMessageContaining("no pertenece al establecimiento");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaElementosNoReservables() {
    resources.found =
        List.of(
            resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE),
            resource(ELEMENT_B, ESTABLISHMENT, ReservationResource.Kind.DECOR));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(InvalidReservationResourceException.class)
        .hasMessageContaining("no admite reservas");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaElementosFueraDeServicio() {
    resources.found =
        List.of(
            resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE),
            new ReservationResource(
                ELEMENT_B,
                ESTABLISHMENT,
                ReservationResource.Kind.TABLE,
                ReservationResource.OperationalState.OUT_OF_SERVICE));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(InvalidReservationResourceException.class)
        .hasMessageContaining("fuera de servicio");
    assertThat(reservations.saved).isNull();
  }

  @Test
  void rechazaTodaLaReservaSiUnElementoSeSuperpone() {
    availability.conflicts = Set.of(ELEMENT_B);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOfSatisfying(
            ReservationOverlapException.class,
            exception -> assertThat(exception.conflictingElementIds()).containsExactly(ELEMENT_B));
    assertThat(reservations.saved).isNull();
  }

  @Test
  void validaDuplicadosAntesDeConsultarOEscribir() {
    CreateReservation.Command duplicated =
        new CreateReservation.Command(
            ESTABLISHMENT, PERSON, List.of(ELEMENT_A, ELEMENT_A), STARTS_AT, ENDS_AT);

    assertThatThrownBy(() -> useCase.execute(duplicated))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("La reserva no puede repetir un elemento");
    assertThat(people.findCalls).isZero();
    assertThat(reservations.saved).isNull();
  }

  private static CreateReservation.Command validCommand() {
    return new CreateReservation.Command(
        ESTABLISHMENT, PERSON, List.of(ELEMENT_A, ELEMENT_B), STARTS_AT, ENDS_AT);
  }

  private static ReservationResource resource(
      UUID id, UUID establishmentId, ReservationResource.Kind kind) {
    return new ReservationResource(
        id, establishmentId, kind, ReservationResource.OperationalState.AVAILABLE);
  }

  private static final class FakePeople implements PersonRepository {
    private @Nullable Person person;
    private int findCalls;

    @Override
    public Optional<Person> findAliveById(TenantId tenantId, UUID id) {
      findCalls++;
      return Optional.ofNullable(person)
          .filter(candidate -> candidate.tenantId().equals(tenantId))
          .filter(candidate -> candidate.id().value().equals(id));
    }

    @Override
    public List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery) {
      return List.of();
    }

    @Override
    public Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail) {
      return Optional.empty();
    }

    @Override
    public Person insert(Person newPerson) {
      person = newPerson;
      return newPerson;
    }
  }

  private static final class FakeResources implements ReservationResourceRepository {
    private boolean establishmentExists = true;
    private List<ReservationResource> found = new ArrayList<>();

    @Override
    public boolean establishmentExists(TenantId tenantId, UUID establishmentId) {
      return establishmentExists;
    }

    @Override
    public List<ReservationResource> findAliveByIds(
        TenantId tenantId, Collection<UUID> elementIds) {
      return found;
    }
  }

  private static final class FakeAvailability implements ReservationAvailabilityRepository {
    private Set<UUID> conflicts = Set.of();

    @Override
    public Set<UUID> findConflictingElementIds(
        TenantId tenantId, Set<UUID> elementIds, ReservationTimeRange timeRange) {
      return conflicts;
    }
  }

  private static final class FakeConcurrencyGuard implements ReservationConcurrencyGuard {
    private Set<UUID> lockedIds = Set.of();

    @Override
    public void lockResources(TenantId tenantId, Set<UUID> elementIds) {
      lockedIds = Set.copyOf(elementIds);
    }
  }

  private static final class FakeReservations implements ReservationRepository {
    private @Nullable Reservation saved;

    @Override
    public Reservation save(Reservation reservation) {
      saved = reservation;
      return reservation;
    }
  }
}
