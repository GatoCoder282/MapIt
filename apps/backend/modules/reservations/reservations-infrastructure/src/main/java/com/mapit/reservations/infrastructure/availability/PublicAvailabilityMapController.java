package com.mapit.reservations.infrastructure.availability;

import java.time.LocalDate;
import java.time.LocalTime;

import org.jspecify.annotations.Nullable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;

import com.mapit.reservations.application.availability.FindPublicAvailabilityMap;
import com.mapit.reservations.application.availability.PublicAvailabilityNotFoundException;
import com.mapit.reservations.domain.availability.PublicAvailabilityMap;

@RestController
@RequestMapping("/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/availability/map")
public class PublicAvailabilityMapController {
  private final FindPublicAvailabilityMap service;
  public PublicAvailabilityMapController(FindPublicAvailabilityMap service) { this.service = service; }
  @GetMapping
  public PublicAvailabilityMap find(@PathVariable String tenantSlug, @PathVariable String establishmentSlug,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) @Nullable String startTime,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) @Nullable LocalDate endDate,
      @RequestParam(required = false) @Nullable String endTime) {
    return service.execute(tenantSlug, establishmentSlug, date, parse(startTime), endDate, parse(endTime));
  }
  private @Nullable LocalTime parse(@Nullable String value) {
    if (value == null) return null;
    if (!value.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) throw new IllegalArgumentException("Horario inválido");
    return LocalTime.parse(value);
  }
  @ExceptionHandler({IllegalArgumentException.class, java.time.DateTimeException.class}) @ResponseStatus(HttpStatus.BAD_REQUEST)
  ProblemDetail invalid() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Fecha o intervalo inválido"); }
  @ExceptionHandler(PublicAvailabilityNotFoundException.class) @ResponseStatus(HttpStatus.NOT_FOUND)
  ProblemDetail missing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Establecimiento no encontrado"); }
}
