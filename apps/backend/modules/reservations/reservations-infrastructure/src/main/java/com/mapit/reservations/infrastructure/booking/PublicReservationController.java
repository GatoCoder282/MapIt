package com.mapit.reservations.infrastructure.booking;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.reservation.CreatePublicReservation;
import com.mapit.reservations.application.reservation.InvalidReservationResourceException;
import com.mapit.reservations.application.reservation.PublicEstablishmentNotFoundException;
import com.mapit.reservations.application.reservation.ReservationOverlapException;
import com.mapit.reservations.application.reservation.ReservationReferenceNotFoundException;
import com.mapit.reservations.application.reservation.ReservationResourceUnavailableException;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.infrastructure.ReservationsProblemTypes;

/** Endpoint anónimo de creación de reservas para el portal público. */
@Validated
@RestController
@RequestMapping(
    "/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations")
public class PublicReservationController {

  private static final String SLUG_REGEX = "^[a-z0-9][a-z0-9-]{1,62}$";
  private static final String TIME_REGEX = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
  private static final int MAX_ELEMENTS_PER_RESERVATION = 100;
  private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

  private final CreatePublicReservation createPublicReservation;

  public PublicReservationController(CreatePublicReservation createPublicReservation) {
    this.createPublicReservation = createPublicReservation;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PublicReservationResponse create(
      @PathVariable @Pattern(regexp = SLUG_REGEX) String tenantSlug,
      @PathVariable @Pattern(regexp = SLUG_REGEX) String establishmentSlug,
      @Valid @RequestBody PublicReservationCreateRequest request,
      HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    CreatePublicReservation.Result result =
        createPublicReservation.execute(
            new CreatePublicReservation.Command(
                tenantSlug,
                establishmentSlug,
                request.date(),
                LocalTime.parse(request.startTime(), TIME_FORMAT),
                request.endDate(),
                LocalTime.parse(request.endTime(), TIME_FORMAT),
                request.spaceElementIds(),
                new CreatePublicReservation.Customer(
                    request.customer().fullName(),
                    request.customer().email(),
                    request.customer().phone())));
    return PublicReservationResponse.from(result);
  }

  @ExceptionHandler(PublicEstablishmentNotFoundException.class)
  ResponseEntity<ProblemDetail> handlePublicEstablishmentNotFound(
      PublicEstablishmentNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Establecimiento no disponible");
    problem.setType(URI.create(ReservationsProblemTypes.PUBLIC_ESTABLISHMENT_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(ReservationReferenceNotFoundException.class)
  ResponseEntity<ProblemDetail> handleReferenceNotFound(
      ReservationReferenceNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Referencia de reserva no encontrada");
    problem.setType(URI.create(ReservationsProblemTypes.REFERENCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(ReservationResourceUnavailableException.class)
  ResponseEntity<ProblemDetail> handleUnavailable(ReservationResourceUnavailableException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Elementos no disponibles");
    problem.setType(URI.create(ReservationsProblemTypes.RESERVATION_UNAVAILABLE));
    problem.setProperty("unavailableElementIds", exception.unavailableElementIds());
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
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

  @ExceptionHandler({IllegalArgumentException.class, InvalidReservationResourceException.class})
  ResponseEntity<ProblemDetail> handleInvalidReservation(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Reserva pública inválida");
    problem.setType(URI.create(ReservationsProblemTypes.INVALID_RESERVATION));
    return ResponseEntity.badRequest().body(problem);
  }

  public record PublicReservationCreateRequest(
      @NotNull @DateTimeFormat(iso = ISO.DATE) LocalDate date,
      @NotNull @Pattern(regexp = TIME_REGEX) String startTime,
      @DateTimeFormat(iso = ISO.DATE) @Nullable LocalDate endDate,
      @NotNull @Pattern(regexp = TIME_REGEX) String endTime,
      @NotEmpty @Size(max = MAX_ELEMENTS_PER_RESERVATION) List<@NotNull UUID> spaceElementIds,
      @Valid @NotNull PublicCustomerRequest customer) {}

  public record PublicCustomerRequest(
      @NotBlank @Size(max = 120) String fullName,
      @NotBlank @Email @Size(max = 254) String email,
      @Size(max = 32) @Nullable String phone) {}

  public record PublicReservationResponse(
      UUID id,
      UUID establishmentId,
      List<UUID> spaceElementIds,
      LocalDate date,
      String startTime,
      LocalDate endDate,
      String endTime,
      java.time.Instant startsAt,
      java.time.Instant endsAt,
      String timezone,
      ReservationStatus status,
      java.time.Instant createdAt,
      String accessToken,
      java.time.Instant accessExpiresAt) {

    static PublicReservationResponse from(CreatePublicReservation.Result result) {
      Reservation reservation = result.reservation();
      return new PublicReservationResponse(
          reservation.id().value(),
          reservation.establishmentId(),
          List.copyOf(reservation.spaceElementIds()),
          result.date(),
          result.startTime().format(TIME_FORMAT),
          result.endDate(),
          result.endTime().format(TIME_FORMAT),
          reservation.timeRange().startsAt(),
          reservation.timeRange().endsAt(),
          result.establishment().timezone(),
          reservation.status(),
          reservation.createdAt(),
          result.access().token(),
          result.access().expiresAt());
    }

    @Override public String toString() { return "PublicReservationResponse[REDACTED]"; }
  }
}
