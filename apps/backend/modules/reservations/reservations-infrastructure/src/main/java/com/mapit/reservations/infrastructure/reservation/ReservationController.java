package com.mapit.reservations.infrastructure.reservation;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.reservation.CreateReservation;
import com.mapit.reservations.application.reservation.InvalidReservationResourceException;
import com.mapit.reservations.application.reservation.ReservationOverlapException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.infrastructure.ReservationsProblemTypes;

/** Adaptador REST para crear reservas internas dentro de un establecimiento. */
@RestController
@RequestMapping("/api/v1/establishments/{establishmentId}/reservations")
public class ReservationController {

  private static final int MAX_ELEMENTS_PER_RESERVATION = 100;

  private final CreateReservation createReservation;

  public ReservationController(CreateReservation createReservation) {
    this.createReservation = createReservation;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ReservationResponse create(
      @PathVariable UUID establishmentId,
      @Valid @RequestBody ReservationCreateRequest request) {
    Reservation reservation =
        createReservation.execute(
            new CreateReservation.Command(
                establishmentId,
                request.personId(),
                request.spaceElementIds(),
                request.startsAt(),
                request.endsAt()));
    return ReservationResponse.fromDomain(reservation);
  }

  @ExceptionHandler(ReservationReferenceNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(ReservationReferenceNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Referencia de reserva no encontrada");
    problem.setType(URI.create(ReservationsProblemTypes.REFERENCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler({IllegalArgumentException.class, InvalidReservationResourceException.class})
  ResponseEntity<ProblemDetail> handleInvalidReservation(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Reserva inválida");
    problem.setType(URI.create(ReservationsProblemTypes.INVALID_RESERVATION));
    return ResponseEntity.badRequest().body(problem);
  }

  @ExceptionHandler(ReservationOverlapException.class)
  ResponseEntity<ProblemDetail> handleOverlap(ReservationOverlapException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Elementos no disponibles");
    problem.setType(URI.create(ReservationsProblemTypes.RESERVATION_OVERLAP));
    problem.setProperty("conflictingElementIds", exception.conflictingElementIds());
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  public record ReservationCreateRequest(
      @NotNull UUID personId,
      @NotEmpty @Size(max = MAX_ELEMENTS_PER_RESERVATION) List<@NotNull UUID> spaceElementIds,
      @NotNull Instant startsAt,
      @NotNull Instant endsAt) {}

  public record ReservationResponse(
      UUID id,
      UUID establishmentId,
      UUID personId,
      List<UUID> spaceElementIds,
      Instant startsAt,
      Instant endsAt,
      ReservationStatus status,
      Instant createdAt,
      UUID createdBy) {

    static ReservationResponse fromDomain(Reservation reservation) {
      return new ReservationResponse(
          reservation.id().value(),
          reservation.establishmentId(),
          reservation.personId().value(),
          List.copyOf(reservation.spaceElementIds()),
          reservation.timeRange().startsAt(),
          reservation.timeRange().endsAt(),
          reservation.status(),
          reservation.createdAt(),
          reservation.createdBy());
    }
  }
}
