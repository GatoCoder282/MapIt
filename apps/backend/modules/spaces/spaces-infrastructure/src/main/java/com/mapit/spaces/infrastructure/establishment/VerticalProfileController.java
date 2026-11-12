package com.mapit.spaces.infrastructure.establishment;

import java.net.URI;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.shared.vertical.BookingMode;
import com.mapit.shared.vertical.VerticalProfile;
import com.mapit.spaces.application.establishment.EstablishmentNotFoundException;
import com.mapit.spaces.application.establishment.ResolveVerticalProfile;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
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
  public VerticalProfileResponse forEstablishment(@PathVariable UUID establishmentId) {
    return VerticalProfileResponse.from(resolve.forEstablishment(establishmentId));
  }

  @GetMapping("/sectors/{sectorId}/vertical-profile")
  public VerticalProfileResponse forSector(@PathVariable UUID sectorId) {
    return VerticalProfileResponse.from(resolve.forSector(sectorId));
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

  /**
   * Payload de salida. Los tipos se ordenan como el enum para que la respuesta sea estable
   * (el catálogo usa {@code Set} y su orden de iteración no está garantizado). Los nulos se
   * serializan: el contrato los declara obligatorios y nulos según el modo de reserva.
   */
  @JsonInclude(JsonInclude.Include.ALWAYS)
  public record VerticalProfileResponse(
      String establishmentType,
      BookingMode bookingMode,
      boolean enabled,
      List<String> allowedElementTypes,
      List<String> reservableElementTypes,
      boolean allowsOvernight,
      @Nullable Long maxDurationMinutes,
      @Nullable Integer minNights,
      @Nullable Integer maxNights,
      @Nullable String defaultStartTime,
      @Nullable String defaultEndTime) {

    static VerticalProfileResponse from(ResolveVerticalProfile.Resolved resolved) {
      VerticalProfile profile = resolved.profile();
      return new VerticalProfileResponse(
          profile.vertical().name(),
          profile.bookingMode(),
          resolved.enabled(),
          ordered(profile.allowedElementTypes()),
          ordered(profile.reservableElementTypes()),
          profile.allowsOvernight(),
          profile.maxDuration() == null ? null : profile.maxDuration().toMinutes(),
          profile.minNights(),
          profile.maxNights(),
          hhmm(profile.defaultStartTime()),
          hhmm(profile.defaultEndTime()));
    }

    private static List<String> ordered(Set<String> types) {
      return java.util.Arrays.stream(SpaceElementType.values())
          .map(Enum::name)
          .filter(types::contains)
          .toList();
    }

    private static @Nullable String hhmm(@Nullable LocalTime time) {
      return time == null ? null : "%02d:%02d".formatted(time.getHour(), time.getMinute());
    }
  }
}
