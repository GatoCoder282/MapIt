package com.mapit.reservations.infrastructure.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import com.mapit.reservations.application.reservation.CreateReservation;
import com.mapit.reservations.application.reservation.InvalidReservationResourceException;
import com.mapit.reservations.application.reservation.ListReservations;
import com.mapit.reservations.application.reservation.ReservationOverlapException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException.Reference;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;

class ReservationControllerTest {

  private static final UUID ESTABLISHMENT =
      UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT = UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID RESERVATION = UUID.fromString("50000000-0000-0000-0000-000000000001");
  private static final UUID RESERVATION_OLDER =
      UUID.fromString("50000000-0000-0000-0000-000000000002");
  private static final Instant STARTS_AT = Instant.parse("2026-10-04T18:00:00Z");
  private static final Instant ENDS_AT = Instant.parse("2026-10-04T20:00:00Z");
  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

  private final LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
  private CreateReservation useCase;
  private ListReservations listUseCase;
  private ReservationController controller;
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    validator.afterPropertiesSet();
    useCase = mock(CreateReservation.class);
    listUseCase = mock(ListReservations.class);
    controller = new ReservationController(useCase, listUseCase);
    client =
        RestTestClient.bindToController(controller)
            .configureServer(builder -> builder.setValidator(validator))
            .build();
  }

  @AfterEach
  void tearDown() {
    validator.destroy();
  }

  @Test
  void devuelve201YMapeaLaSolicitudAlCasoDeUso() {
    when(useCase.execute(any())).thenReturn(reservation());

    client
        .post()
        .uri("/api/v1/establishments/{id}/reservations", ESTABLISHMENT)
        .contentType(MediaType.APPLICATION_JSON)
        .body(
            Map.of(
                "personId", PERSON,
                "spaceElementIds", List.of(ELEMENT),
                "startsAt", STARTS_AT.toString(),
                "endsAt", ENDS_AT.toString()))
        .exchange()
        .expectStatus()
        .isCreated()
        .expectBody()
        .jsonPath("$.establishmentId")
        .isEqualTo(ESTABLISHMENT.toString())
        .jsonPath("$.personId")
        .isEqualTo(PERSON.toString())
        .jsonPath("$.status")
        .isEqualTo("CREATED");

    ArgumentCaptor<CreateReservation.Command> command =
        ArgumentCaptor.forClass(CreateReservation.Command.class);
    verify(useCase).execute(command.capture());
    assertThat(command.getValue().establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(command.getValue().spaceElementIds()).containsExactly(ELEMENT);
  }

  @Test
  void listaLasReservasDelTenant() {
    when(listUseCase.execute()).thenReturn(List.of(reservation(), olderReservation()));

    client
        .get()
        .uri("/api/v1/reservations")
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.length()")
        .isEqualTo(2)
        .jsonPath("$[0].id")
        .isEqualTo(RESERVATION.toString())
        .jsonPath("$[0].establishmentId")
        .isEqualTo(ESTABLISHMENT.toString())
        .jsonPath("$[0].personId")
        .isEqualTo(PERSON.toString())
        .jsonPath("$[0].status")
        .isEqualTo("CREATED")
        .jsonPath("$[0].spaceElementIds.length()")
        .isEqualTo(1)
        .jsonPath("$[1].id")
        .isEqualTo(RESERVATION_OLDER.toString());
  }

  /**
   * Sin tenant en el contexto no se listan reservas: la llamada se rechaza antes de
   * tocar el repositorio.
   *
   * <p>El 401 de una petición HTTP sin token lo decide la cadena de seguridad, que no
   * existe en este test de controlador; aquí se prueba que el caso de uso no sirve
   * datos sin tenant.
   */
  @Test
  void rechazaLaLlamadaSinTenant() {
    InMemoryReservations repositorio = new InMemoryReservations();
    ListReservations sinTenant = new ListReservations(repositorio, () -> Optional.empty());

    assertThatThrownBy(sinTenant::execute)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No hay tenant en el contexto");
    assertThat(repositorio.consultas).isZero();
  }

  @Test
  void devuelve400AntesDelCasoDeUsoCuandoFaltanElementos() {
    client
        .post()
        .uri("/api/v1/establishments/{id}/reservations", ESTABLISHMENT)
        .contentType(MediaType.APPLICATION_JSON)
        .body(
            Map.of(
                "personId", PERSON,
                "spaceElementIds", List.of(),
                "startsAt", STARTS_AT.toString(),
                "endsAt", ENDS_AT.toString()))
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void traduceReferenciasOcultasA404() {
    var response =
        controller.handleNotFound(new ReservationReferenceNotFoundException(Reference.PERSON, PERSON));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().getTitle()).isEqualTo("Referencia de reserva no encontrada");
  }

  @Test
  void traduceRecursosInvalidosA400() {
    var response =
        controller.handleInvalidReservation(
            InvalidReservationResourceException.notReservable(ELEMENT));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().getTitle()).isEqualTo("Reserva inválida");
  }

  @Test
  void traduceSolapamientosA409ConLosElementosEnConflicto() {
    var response = controller.handleOverlap(new ReservationOverlapException(Set.of(ELEMENT)));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().getTitle()).isEqualTo("Elementos no disponibles");
    assertThat(response.getBody().getProperties())
        .containsEntry("conflictingElementIds", Set.of(ELEMENT));
  }

  private static Reservation reservation() {
    return reservation(RESERVATION);
  }

  private static Reservation olderReservation() {
    return reservation(RESERVATION_OLDER);
  }

  private static Reservation reservation(UUID id) {
    return Reservation.create(
        ReservationId.of(id),
        TenantId.of("tenant-a"),
        ESTABLISHMENT,
        PersonId.of(PERSON),
        List.of(ELEMENT),
        ReservationTimeRange.of(STARTS_AT, ENDS_AT),
        NOW,
        ACTOR);
  }

  /** Repositorio en memoria: este test no habla con la base de datos. */
  private static final class InMemoryReservations implements ReservationRepository {

    private final List<Reservation> guardadas = new ArrayList<>();
    private int consultas;

    @Override
    public Reservation save(Reservation reservation) {
      guardadas.add(reservation);
      return reservation;
    }

    @Override
    public List<Reservation> findAll(TenantId tenantId) {
      consultas++;
      return List.of();
    }
  }
}
