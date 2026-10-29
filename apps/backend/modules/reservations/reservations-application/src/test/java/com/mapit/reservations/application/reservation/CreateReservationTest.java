package com.mapit.reservations.application.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
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
import com.mapit.reservations.domain.reservation.ReservationVenue;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalDisabledException;
import com.mapit.shared.vertical.VerticalGate;

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
  private FakeAuditEvents auditEvents;
  private CreateReservation useCase;
  private final FakeFlags flags = new FakeFlags();

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
    auditEvents = new FakeAuditEvents();
    TenantContext tenantContext = () -> Optional.of(TENANT);
    ActorContext actorContext = () -> Optional.of(ACTOR);
    useCase =
        new CreateReservation(
            people,
            resources,
            concurrencyGuard,
            availability,
            reservations,
            auditEvents,
            tenantContext,
            actorContext,
            Clock.fixed(NOW, ZoneOffset.UTC),
            new VerticalGate(flags));
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
    assertThat(auditEvents.events).singleElement().satisfies(event -> {
      assertThat(event.tenantId()).isEqualTo(TENANT);
      assertThat(event.actorId()).isEqualTo(ACTOR);
      assertThat(event.occurredAt()).isEqualTo(NOW);
      assertThat(event.resourceType()).isEqualTo(AuditResourceType.RESERVATION);
      assertThat(event.resourceId()).isEqualTo(created.id().value());
      assertThat(event.eventType()).isEqualTo(AuditEventType.RESERVATION_CREATED);
      assertThat(event.details())
          .containsExactlyInAnyOrderEntriesOf(
              java.util.Map.of(
                  "status", "CREATED", "establishmentId", ESTABLISHMENT.toString()));
    });
  }

  @Test
  void noPersisteCuandoLaPersonaNoPerteneceAlTenant() {
    people.person = null;

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(ReservationReferenceNotFoundException.class)
        .hasMessageContaining("Cliente no encontrado");
    assertThat(reservations.saved).isNull();
    assertThat(auditEvents.events).isEmpty();
  }

  // ── HU-7.01/7.02 · MAP-233: reglas por vertical sobre el mismo caso de uso ──

  @Test
  void hotelReservaUnaHabitacionPorNochesYRechazaUnaMesa() {
    resources.vertical = "HOTEL";
    resources.found = List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.ROOM));

    Reservation stay =
        useCase.execute(
            new CreateReservation.Command(
                ESTABLISHMENT,
                PERSON,
                List.of(ELEMENT_A),
                Instant.parse("2026-10-04T19:00:00Z"),
                Instant.parse("2026-10-06T16:00:00Z")));
    assertThat(stay.spaceElementIds()).containsExactly(ELEMENT_A);

    resources.found = List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.TABLE));
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new CreateReservation.Command(
                        ESTABLISHMENT,
                        PERSON,
                        List.of(ELEMENT_A),
                        Instant.parse("2026-10-04T19:00:00Z"),
                        Instant.parse("2026-10-06T16:00:00Z"))))
        .isInstanceOf(InvalidReservationResourceException.class)
        .hasMessageContaining("no admite reservas");
  }

  @Test
  void hotelRechazaUnaEstadiaSinNochesAntesDeBloquear() {
    resources.vertical = "HOTEL";
    resources.found = List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.ROOM));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("noches");
    assertThat(concurrencyGuard.lockedIds).isEmpty();
    assertThat(reservations.saved).isNull();
  }

  @Test
  void restauranteRechazaUnTurnoQueCruzaElDiaYUnEscenario() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new CreateReservation.Command(
                        ESTABLISHMENT,
                        PERSON,
                        List.of(ELEMENT_A),
                        Instant.parse("2026-10-05T02:00:00Z"),
                        Instant.parse("2026-10-05T05:00:00Z"))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("mismo día");

    resources.found = List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.STAGE));
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new CreateReservation.Command(
                        ESTABLISHMENT, PERSON, List.of(ELEMENT_A), STARTS_AT, ENDS_AT)))
        .isInstanceOf(InvalidReservationResourceException.class);
  }

  @Test
  void discotecaAceptaUnaNocheQueCruzaLaMedianoche() {
    resources.vertical = "NIGHTCLUB";
    resources.found =
        List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.SECTOR_ZONE));

    Reservation night =
        useCase.execute(
            new CreateReservation.Command(
                ESTABLISHMENT,
                PERSON,
                List.of(ELEMENT_A),
                Instant.parse("2026-10-05T03:00:00Z"),
                Instant.parse("2026-10-05T08:00:00Z")));
    assertThat(night.timeRange().endsAt()).isEqualTo(Instant.parse("2026-10-05T08:00:00Z"));
  }

  @Test
  void salonReservaVariasButacasNumeradasEnUnaSolaReserva() {
    resources.vertical = "EVENT_HALL";
    resources.found =
        List.of(
            resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.SEAT),
            resource(ELEMENT_B, ESTABLISHMENT, ReservationResource.Kind.SEAT));

    assertThat(useCase.execute(validCommand()).spaceElementIds())
        .containsExactlyInAnyOrder(ELEMENT_A, ELEMENT_B);
  }

  @Test
  void unaVerticalApagadaNoReservaNiCambiaDeVertical() {
    resources.vertical = "HOTEL";
    resources.found = List.of(resource(ELEMENT_A, ESTABLISHMENT, ReservationResource.Kind.ROOM));
    flags.off.add(FeatureFlag.VERTICAL_HOTEL);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOfSatisfying(
            VerticalDisabledException.class,
            ex -> assertThat(ex.vertical()).isEqualTo(Vertical.HOTEL));
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
  void creaUnaReservaPublicaSinActorDeCreacion() {
    Reservation created =
        useCase.create(
            TENANT,
            null,
            ESTABLISHMENT,
            PersonId.of(PERSON),
            List.of(ELEMENT_A),
            STARTS_AT,
            ENDS_AT,
            true);

    assertThat(created.createdBy()).isNull();
    assertThat(created.status()).isEqualTo(ReservationStatus.CREATED);
    assertThat(reservations.saved).isSameAs(created);
  }

  @Test
  void unaReservaPublicaRechazaElementosFueraDeServicioComoNoDisponibles() {
    resources.found =
        List.of(
            new ReservationResource(
                ELEMENT_A,
                ESTABLISHMENT,
                ReservationResource.Kind.TABLE,
                ReservationResource.OperationalState.OUT_OF_SERVICE));

    assertThatThrownBy(
            () ->
                useCase.create(
                    TENANT,
                    null,
                    ESTABLISHMENT,
                    PersonId.of(PERSON),
                    List.of(ELEMENT_A),
                    STARTS_AT,
                    ENDS_AT,
                    true))
        .isInstanceOfSatisfying(
            ReservationResourceUnavailableException.class,
            exception ->
                assertThat(exception.unavailableElementIds()).containsExactly(ELEMENT_A));
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

    @Override
    public Person findOrCreatePublic(Person newPerson) {
      return insert(newPerson);
    }
  }

  private static final class FakeResources implements ReservationResourceRepository {
    private boolean establishmentExists = true;
    private String vertical = "RESTAURANT";
    private List<ReservationResource> found = new ArrayList<>();

    @Override
    public boolean establishmentExists(TenantId tenantId, UUID establishmentId) {
      return establishmentExists;
    }

    @Override
    public Optional<ReservationVenue> findVenue(TenantId tenantId, UUID establishmentId) {
      return establishmentExists
          ? Optional.of(new ReservationVenue(vertical, "America/La_Paz"))
          : Optional.empty();
    }

    @Override
    public List<ReservationResource> findAliveByIds(
        TenantId tenantId, Collection<UUID> elementIds) {
      return found;
    }
  }

  /** Unleash en memoria: todas las verticales encendidas salvo las que el test apague. */
  private static final class FakeFlags implements FeatureFlagPort {
    private final Set<FeatureFlag> off = new HashSet<>();

    @Override
    public boolean isEnabled(FeatureFlag flag) {
      return !off.contains(flag);
    }

    @Override
    public boolean isEnabled(FeatureFlag flag, boolean defaultValue) {
      return !off.contains(flag);
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

    @Override
    public List<Reservation> findAll(TenantId tenantId) {
      return List.of();
    }
  }

  private static final class FakeAuditEvents implements AuditEventRecorder {
    private final List<AuditEvent> events = new ArrayList<>();

    @Override
    public void record(AuditEvent event) {
      events.add(event);
    }
  }
}
