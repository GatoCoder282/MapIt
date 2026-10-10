package com.mapit.reservations.infrastructure.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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
import com.mapit.reservations.application.reservation.ReservationOverlapException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException.Reference;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;

class ReservationControllerTest {

  private static final UUID ESTABLISHMENT =
      UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT = UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final Instant STARTS_AT = Instant.parse("2026-10-04T18:00:00Z");
  private static final Instant ENDS_AT = Instant.parse("2026-10-04T20:00:00Z");
  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

  private final LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
  private CreateReservation useCase;
  private ReservationController controller;
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    validator.afterPropertiesSet();
    useCase = mock(CreateReservation.class);
    controller = new ReservationController(useCase);
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
    return Reservation.create(
        ReservationId.of(UUID.fromString("50000000-0000-0000-0000-000000000001")),
        TenantId.of("tenant-a"),
        ESTABLISHMENT,
        PersonId.of(PERSON),
        List.of(ELEMENT),
        ReservationTimeRange.of(STARTS_AT, ENDS_AT),
        NOW,
        ACTOR);
  }
}
