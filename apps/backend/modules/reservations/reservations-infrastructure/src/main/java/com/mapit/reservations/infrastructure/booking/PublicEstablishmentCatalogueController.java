package com.mapit.reservations.infrastructure.booking;

import java.util.List;

import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.reservation.PublicReservationAccessService;
import com.mapit.reservations.domain.booking.ReservationAccessRepository;

/** Catálogo anónimo limitado, sin métricas ni datos personales inventados. */
@Validated
@RestController
@RequestMapping("/api/v1/public")
public class PublicEstablishmentCatalogueController {
  private final PublicReservationAccessService access;

  public PublicEstablishmentCatalogueController(PublicReservationAccessService access) {
    this.access = access;
  }

  @GetMapping("/establishments")
  public List<ReservationAccessRepository.PublicVenue> list(
      @RequestParam(required = false) @Nullable @Size(max = 120) String query,
      @RequestParam(required = false) @Nullable String tenantSlug,
      @RequestParam(defaultValue="20") int limit,@RequestParam(defaultValue="0") int offset) {
    return access.catalogue(query,tenantSlug,limit,offset);
  }
  @GetMapping("/tenants/{tenantSlug}/establishments/{establishmentSlug}")
  public ReservationAccessRepository.PublicVenue details(@org.springframework.web.bind.annotation.PathVariable String tenantSlug,@org.springframework.web.bind.annotation.PathVariable String establishmentSlug){return access.publicEstablishment(tenantSlug,establishmentSlug);}
  @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
  public org.springframework.http.ResponseEntity<org.springframework.http.ProblemDetail> invalid(){
    return org.springframework.http.ResponseEntity.badRequest().header("Cache-Control","no-store")
        .body(org.springframework.http.ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatus.BAD_REQUEST,"Filtros de establecimientos inválidos"));
  }
}
