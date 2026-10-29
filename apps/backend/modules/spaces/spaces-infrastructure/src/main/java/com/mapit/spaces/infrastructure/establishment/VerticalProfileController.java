package com.mapit.spaces.infrastructure.establishment;

import java.net.URI;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.shared.vertical.VerticalProfileView;
import com.mapit.spaces.application.establishment.EstablishmentNotFoundException;
import com.mapit.spaces.application.establishment.ResolveVerticalProfile;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;

/** Perfil de vertical de un establecimiento o del que contiene un sector (HU-7.01/7.02). */
@RestController
@RequestMapping("/api/v1")
public class VerticalProfileController {

  private final ResolveVerticalProfile resolve;

  public VerticalProfileController(ResolveVerticalProfile resolve) {
    this.resolve = resolve;
  }

  @GetMapping("/establishments/{establishmentId}/vertical-profile")
  public VerticalProfileView forEstablishment(@PathVariable UUID establishmentId) {
    return view(resolve.forEstablishment(establishmentId));
  }

  @GetMapping("/sectors/{sectorId}/vertical-profile")
  public VerticalProfileView forSector(@PathVariable UUID sectorId) {
    return view(resolve.forSector(sectorId));
  }

  @ExceptionHandler(EstablishmentNotFoundException.class)
  ResponseEntity<ProblemDetail> handleEstablishmentNotFound(EstablishmentNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Establecimiento no encontrado");
    problem.setType(URI.create(SpacesProblemTypes.ESTABLISHMENT_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(SectorNotFoundException.class)
  ResponseEntity<ProblemDetail> handleSectorNotFound(SectorNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Sector no encontrado");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  private static VerticalProfileView view(ResolveVerticalProfile.Resolved resolved) {
    return VerticalProfileView.of(resolved.profile(), resolved.enabled());
  }
}
