package com.mapit.spaces.infrastructure.layout;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.application.layout.DuplicateSectorCommand;
import com.mapit.spaces.application.layout.DuplicateSectorUseCase;
import com.mapit.spaces.application.layout.GetFloorLayoutUseCase;
import com.mapit.spaces.application.layout.LayoutConflictException;
import com.mapit.spaces.application.layout.LayoutOutOfBoundsException;
import com.mapit.spaces.application.layout.SaveFloorLayoutCommand;
import com.mapit.spaces.application.layout.SaveFloorLayoutUseCase;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.application.spaceelement.InvalidElementTypeForVerticalException;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.layout.FloorLayout;
import com.mapit.spaces.domain.layout.SectorLayout;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;

/**
 * Adaptador REST del layout de planta (HU-4.01): lectura agregada, guardado por
 * lotes de colocaciones y duplicado de sectores. Contrato: `openapi.yaml`
 * (`getFloorLayout`, `saveFloorLayout`, `duplicateSector`).
 */
@RestController
@RequestMapping("/api/v1")
public class FloorLayoutController {

  private final GetFloorLayoutUseCase getFloorLayout;
  private final SaveFloorLayoutUseCase saveFloorLayout;
  private final DuplicateSectorUseCase duplicateSector;

  public FloorLayoutController(
      GetFloorLayoutUseCase getFloorLayout,
      SaveFloorLayoutUseCase saveFloorLayout,
      DuplicateSectorUseCase duplicateSector) {
    this.getFloorLayout = getFloorLayout;
    this.saveFloorLayout = saveFloorLayout;
    this.duplicateSector = duplicateSector;
  }

  @GetMapping("/floors/{floorId}/layout")
  public FloorLayoutResponse getLayout(@PathVariable UUID floorId) {
    return FloorLayoutResponse.fromDomain(getFloorLayout.get(floorId));
  }

  @PutMapping("/floors/{floorId}/layout")
  public FloorLayoutResponse saveLayout(
      @PathVariable UUID floorId, @Valid @RequestBody FloorLayoutUpdateRequest request) {
    var command = new SaveFloorLayoutCommand(
        request.floor().canvasWidth(),
        request.floor().canvasHeight(),
        request.floor().updatedAt(),
        request.sectors().stream()
            .map(s -> new SaveFloorLayoutCommand.SectorPlacement(
                s.id(), s.x(), s.y(), s.rotation(), s.updatedAt()))
            .toList());
    Floor saved = saveFloorLayout.save(floorId, command);
    return FloorLayoutResponse.fromDomain(getFloorLayout.get(saved.id()));
  }

  @PostMapping("/floors/{floorId}/sectors:duplicate")
  public ResponseEntity<SectorLayoutResponse> duplicate(
      @PathVariable UUID floorId, @Valid @RequestBody SectorDuplicateRequest request) {
    SectorLayout duplicated =
        duplicateSector.duplicate(
            floorId,
            new DuplicateSectorCommand(
                request.sourceSectorId(), request.name(), request.slug()));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(SectorLayoutResponse.fromDomain(duplicated));
  }

  // ---- Problem Details ----

  @ExceptionHandler({FloorNotFoundException.class, SectorNotFoundException.class})
  ResponseEntity<ProblemDetail> handleNotFound(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Recurso no encontrado");
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

  @ExceptionHandler({LayoutOutOfBoundsException.class, InvalidElementTypeForVerticalException.class,
      IllegalArgumentException.class})
  ResponseEntity<ProblemDetail> handleBadRequest(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Layout inválido");
    problem.setType(URI.create(SpacesProblemTypes.LAYOUT_OUT_OF_BOUNDS));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
  }

  // ---- DTOs ----

  public record FloorCanvasPatch(
      double canvasWidth, double canvasHeight, @NotNull Instant updatedAt) {}

  public record SectorPlacementRequest(
      @NotNull UUID id, double x, double y, double rotation, @NotNull Instant updatedAt) {}

  public record FloorLayoutUpdateRequest(
      @NotNull @Valid FloorCanvasPatch floor,
      @NotNull List<@Valid SectorPlacementRequest> sectors) {}

  public record SectorDuplicateRequest(
      @NotNull UUID sourceSectorId, String name, String slug) {}

  public record SpaceElementDto(
      UUID id, UUID sectorId, String type, double x, double y,
      double width, double height, double rotation, String state,
      Instant createdAt, Instant updatedAt) {
    static SpaceElementDto fromDomain(SpaceElement el) {
      return new SpaceElementDto(
          el.id().value(), el.sectorId(), el.type().name(),
          el.x(), el.y(), el.width(), el.height(), el.rotation(),
          el.state().name(), el.audit().createdAt(), el.audit().updatedAt());
    }
  }

  public record SectorLayoutDto(
      UUID id, String name, double x, double y, double rotation,
      double width, double height, Instant updatedAt, List<SpaceElementDto> elements) {
    static SectorLayoutDto fromDomain(SectorLayout layout) {
      Sector s = layout.sector();
      return new SectorLayoutDto(
          s.id().value(), s.name(),
          s.placement().x(), s.placement().y(), s.placement().rotation(),
          s.geometry().width(), s.geometry().height(),
          s.audit().updatedAt(),
          layout.elements().stream().map(SpaceElementDto::fromDomain).toList());
    }
  }

  public record FloorDto(
      UUID id, String name, String slug, int level, double canvasWidth, double canvasHeight,
      Instant createdAt, Instant updatedAt) {
    static FloorDto fromDomain(Floor floor) {
      return new FloorDto(
          floor.id(), floor.name(), floor.slug() != null ? floor.slug().value() : null,
          floor.level(), floor.canvasWidth(), floor.canvasHeight(),
          floor.audit().createdAt(), floor.audit().updatedAt());
    }
  }

  public record FloorLayoutResponse(FloorDto floor, List<SectorLayoutDto> sectors) {
    static FloorLayoutResponse fromDomain(FloorLayout layout) {
      return new FloorLayoutResponse(
          FloorDto.fromDomain(layout.floor()),
          layout.sectors().stream().map(SectorLayoutDto::fromDomain).toList());
    }
  }

  public record SectorLayoutResponse(SectorDto sector, List<SpaceElementDto> elements) {
    static SectorLayoutResponse fromDomain(SectorLayout layout) {
      return new SectorLayoutResponse(
          SectorDto.fromDomain(layout.sector()),
          layout.elements().stream().map(SpaceElementDto::fromDomain).toList());
    }
  }

  public record SectorDto(
      UUID id, String name, String slug, Integer maxCapacity,
      double x, double y, double rotation, double width, double height,
      Instant createdAt, Instant updatedAt) {
    public static SectorDto fromDomain(Sector s) {
      return new SectorDto(
          s.id().value(), s.name(), s.slug().value(), s.maxCapacity(),
          s.placement().x(), s.placement().y(), s.placement().rotation(),
          s.geometry().width(), s.geometry().height(),
          s.audit().createdAt(), s.audit().updatedAt());
    }
  }
}
