package com.mapit.spaces.infrastructure.layout;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.layout.LayoutConflictException;
import com.mapit.spaces.application.layout.LayoutOutOfBoundsException;
import com.mapit.spaces.application.layout.SaveSectorLayoutCommand;
import com.mapit.spaces.application.layout.SaveSectorLayoutUseCase;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.application.spaceelement.InvalidElementTypeForVerticalException;
import com.mapit.spaces.application.spaceelement.SpaceElementHasActiveReservationsException;
import com.mapit.spaces.application.spaceelement.SpaceElementResponse;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;
import com.mapit.spaces.infrastructure.layout.FloorLayoutController.SectorDto;
import com.mapit.spaces.infrastructure.layout.FloorLayoutController.SectorLayoutResponse;

/** Adaptador REST del layout interno de un sector (HU-4.01, `saveSectorLayout`). */
@RestController
@RequestMapping("/api/v1")
public class SectorLayoutController {

  private final SaveSectorLayoutUseCase saveSectorLayout;

  public SectorLayoutController(SaveSectorLayoutUseCase saveSectorLayout) {
    this.saveSectorLayout = saveSectorLayout;
  }

  @PutMapping("/sectors/{sectorId}/layout")
  public SectorLayoutResponse saveLayout(
      @PathVariable UUID sectorId, @Valid @RequestBody SectorLayoutUpdateRequest request) {
    var command = new SaveSectorLayoutCommand(
        request.sector().width(),
        request.sector().height(),
        request.sector().updatedAt(),
        request.elements().stream()
            .map(e -> new SaveSectorLayoutCommand.ElementGeometry(
                e.id(), e.x(), e.y(), e.width(), e.height(), e.rotation(), e.updatedAt()))
            .toList(),
        request.createdElements().stream()
            .map(e -> new SaveSectorLayoutCommand.ElementCreate(
                e.id(), e.type(), e.x(), e.y(), e.width(), e.height(), e.rotation(), e.label(), e.capacity()))
            .toList(),
        request.deletedElements().stream()
            .map(e -> new SaveSectorLayoutCommand.ElementDelete(e.id(), e.updatedAt()))
            .toList(),
        request.metadataUpdates().stream()
            .map(e -> new SaveSectorLayoutCommand.MetadataUpdate(e.id(), e.label(), e.capacity(), e.updatedAt()))
            .toList(),
        request.appearance());
    var saved = saveSectorLayout.save(sectorId, command);
    return new SectorLayoutResponse(
        SectorDto.fromDomain(saved.sector()),
        saved.elements().stream().map(SpaceElementResponse::fromDomain).toList());
  }

  @ExceptionHandler(SectorNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(SectorNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Sector no encontrado");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(LayoutConflictException.class)
  ResponseEntity<ProblemDetail> handleConflict(LayoutConflictException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Conflicto de concurrencia");
    problem.setType(URI.create(SpacesProblemTypes.LAYOUT_CONFLICT));
    problem.setProperty("conflictingIds", exception.conflictingIds());
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(SpaceElementHasActiveReservationsException.class)
  ResponseEntity<ProblemDetail> handleActiveReservations(SpaceElementHasActiveReservationsException exception) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("El elemento tiene reservas activas");
    problem.setType(URI.create(SpacesProblemTypes.ELEMENT_HAS_ACTIVE_RESERVATIONS));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler({LayoutOutOfBoundsException.class, IllegalArgumentException.class,
      InvalidElementTypeForVerticalException.class})
  ResponseEntity<ProblemDetail> handleBadRequest(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Layout inválido");
    problem.setType(URI.create(SpacesProblemTypes.LAYOUT_OUT_OF_BOUNDS));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
  }

  // ---- DTOs ----

  public record SectorGeometryPatch(@NotNull Double width, @NotNull Double height, @NotNull Instant updatedAt) {}

  public record ElementGeometryRequest(
      @NotNull UUID id, @NotNull Double x, @NotNull Double y, @NotNull Double width,
      @NotNull Double height, @NotNull Double rotation,
      @NotNull Instant updatedAt) {}

  public record ElementCreateRequest(
      @NotNull UUID id, @NotNull String type, @NotNull Double x, @NotNull Double y,
      @NotNull Double width, @NotNull Double height, @NotNull Double rotation,
      @Nullable @Size(max = 120) String label, @Nullable @Positive Integer capacity) {}

  public record ElementDeleteRequest(@NotNull UUID id, @NotNull Instant updatedAt) {}

  public record MetadataUpdateRequest(
      @NotNull UUID id, @Nullable @Size(max = 120) String label,
      @Nullable @Positive Integer capacity, @NotNull Instant updatedAt) {}

  public record SectorLayoutUpdateRequest(
      @NotNull @Valid SectorGeometryPatch sector,
      @NotNull List<@NotNull @Valid ElementGeometryRequest> elements,
      List<@NotNull @Valid ElementCreateRequest> createdElements,
      List<@NotNull @Valid ElementDeleteRequest> deletedElements,
      List<@NotNull @Valid MetadataUpdateRequest> metadataUpdates,
      @Nullable Map<String, Object> appearance) {
    public SectorLayoutUpdateRequest {
      createdElements = Objects.requireNonNullElse(createdElements, List.of());
      deletedElements = Objects.requireNonNullElse(deletedElements, List.of());
      metadataUpdates = Objects.requireNonNullElse(metadataUpdates, List.of());
    }
  }
}
