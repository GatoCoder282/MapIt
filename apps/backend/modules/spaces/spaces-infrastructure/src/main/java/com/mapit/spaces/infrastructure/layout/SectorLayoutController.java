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
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;
import com.mapit.spaces.infrastructure.layout.FloorLayoutController.SectorDto;
import com.mapit.spaces.infrastructure.layout.FloorLayoutController.SectorLayoutResponse;

/** Adaptador REST del layout interno de un sector (HU-4.01, `saveSectorLayout`). */
@RestController
@RequestMapping("/api/v1")
public class SectorLayoutController {

  private final SaveSectorLayoutUseCase saveSectorLayout;
  private final com.mapit.spaces.domain.spaceelement.SpaceElementRepository elements;
  private final com.mapit.shared.tenant.TenantContext tenantContext;

  public SectorLayoutController(
      SaveSectorLayoutUseCase saveSectorLayout,
      com.mapit.spaces.domain.spaceelement.SpaceElementRepository elements,
      com.mapit.shared.tenant.TenantContext tenantContext) {
    this.saveSectorLayout = saveSectorLayout;
    this.elements = elements;
    this.tenantContext = tenantContext;
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
            .toList());
    Sector saved = saveSectorLayout.save(sectorId, command);
    var live = elements.findAliveBySectorId(tenantContext.require(), sectorId);
    return new SectorLayoutResponse(
        SectorDto.fromDomain(saved),
        live.stream().map(FloorLayoutController.SpaceElementDto::fromDomain).toList());
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

  @ExceptionHandler({LayoutOutOfBoundsException.class, IllegalArgumentException.class})
  ResponseEntity<ProblemDetail> handleBadRequest(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Layout inválido");
    problem.setType(URI.create(SpacesProblemTypes.LAYOUT_OUT_OF_BOUNDS));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
  }

  // ---- DTOs ----

  public record SectorGeometryPatch(double width, double height, @NotNull Instant updatedAt) {}

  public record ElementGeometryRequest(
      @NotNull UUID id, double x, double y, double width, double height, double rotation,
      @NotNull Instant updatedAt) {}

  public record SectorLayoutUpdateRequest(
      @NotNull @Valid SectorGeometryPatch sector,
      @NotNull List<@Valid ElementGeometryRequest> elements) {}
}
