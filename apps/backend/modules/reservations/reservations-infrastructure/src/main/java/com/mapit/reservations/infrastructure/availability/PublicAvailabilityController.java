package com.mapit.reservations.infrastructure.availability;

import java.net.URI;
import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.availability.FindPublicAvailability;
import com.mapit.reservations.application.availability.PublicAvailabilityNotFoundException;
import com.mapit.reservations.domain.availability.PublicAvailability;
import com.mapit.reservations.infrastructure.ReservationsProblemTypes;

/** Endpoint anónimo de disponibilidad para el portal público. */
@Validated
@RestController
@RequestMapping(
    "/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/availability")
public class PublicAvailabilityController {

  private static final String SLUG_REGEX = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final FindPublicAvailability availability;

  public PublicAvailabilityController(FindPublicAvailability availability) {
    this.availability = availability;
  }

  @GetMapping
  public PublicAvailability find(
      @PathVariable @jakarta.validation.constraints.Pattern(regexp = SLUG_REGEX) String tenantSlug,
      @PathVariable @jakarta.validation.constraints.Pattern(regexp = SLUG_REGEX)
          String establishmentSlug,
      @RequestParam("date") @NotNull @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
    return availability.execute(new FindPublicAvailability.Query(tenantSlug, establishmentSlug, date));
  }

  @ExceptionHandler(PublicAvailabilityNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(PublicAvailabilityNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Disponibilidad no encontrada");
    problem.setType(URI.create(ReservationsProblemTypes.PUBLIC_AVAILABILITY_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }
}
