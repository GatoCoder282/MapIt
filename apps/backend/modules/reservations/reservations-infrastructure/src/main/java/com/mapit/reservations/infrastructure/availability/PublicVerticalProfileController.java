package com.mapit.reservations.infrastructure.availability;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.availability.FindPublicVerticalProfile;
import com.mapit.reservations.application.availability.PublicAvailabilityNotFoundException;
import com.mapit.shared.vertical.VerticalProfileView;

/** Perfil de vertical para el portal público, antes de buscar disponibilidad (HU-7.01/7.02). */
@RestController
@RequestMapping(
    "/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/vertical-profile")
public class PublicVerticalProfileController {

  private final FindPublicVerticalProfile service;

  public PublicVerticalProfileController(FindPublicVerticalProfile service) {
    this.service = service;
  }

  @GetMapping
  public VerticalProfileView find(
      @PathVariable String tenantSlug, @PathVariable String establishmentSlug) {
    return service.execute(tenantSlug, establishmentSlug);
  }

  @ExceptionHandler(PublicAvailabilityNotFoundException.class)
  @ResponseStatus(HttpStatus.NOT_FOUND)
  ProblemDetail missing() {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Establecimiento no encontrado");
  }
}
