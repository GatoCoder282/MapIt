package com.mapit.spaces.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors; // Import for Collectors.toList()

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.EstablishmentNotFoundException; // Assuming this exception exists from CU-04
import com.mapit.spaces.application.FloorHasActiveSectorsException;
import com.mapit.spaces.application.FloorLevelAlreadyExistsException;
import com.mapit.spaces.application.FloorNotFoundException;
import com.mapit.spaces.application.FloorService;
import com.mapit.spaces.application.FloorSlugAlreadyExistsException;
import com.mapit.spaces.domain.Floor;
import com.mapit.spaces.domain.Slug; // Import Slug

/**
 * Adaptador REST de la gestión de pisos (CU-05).
 */
@RestController
@RequestMapping("/api/v1")
public class FloorController {

  // Regex for slug validation, consistent with domain and database constraints.
  // This regex ensures the slug starts with an alphanumeric character and can contain
  // alphanumeric characters and hyphens, with a total length between 2 and 62.
  private static final String SLUG_REGEX = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final FloorService service;

  public FloorController(FloorService service) {
    this.service = service;
  }

  @GetMapping("/establishments/{establishmentId}/floors")
  public List<FloorResponse> findByEstablishment(@PathVariable UUID establishmentId) {
    // Delegate to service and map domain objects to DTOs
    return service.findByEstablishment(establishmentId).stream()
        .map(FloorResponse::fromDomain)
        .collect(Collectors.toList()); // Use Collectors.toList()
  }

  @GetMapping("/floors/{id}")
  public FloorResponse findById(@PathVariable UUID id) {
    // Delegate to service and map domain object to DTO
    return FloorResponse.fromDomain(service.findById(id));
  }

  @PostMapping("/establishments/{establishmentId}/floors")
  @ResponseStatus(HttpStatus.CREATED)
  public FloorResponse create(
      @PathVariable UUID establishmentId,
      @Valid @RequestBody FloorCreateRequest request) {
    // Delegate to service and map domain object to DTO
    return FloorResponse.fromDomain(
        service.create(
            establishmentId,
            request.name(),
            request.level(), // Level can be null from request, service handles default
            request.slug()));
  }

  @PutMapping("/floors/{id}")
  public FloorResponse update(
      @PathVariable UUID id,
      @Valid @RequestBody FloorUpdateRequest request) {
    // Delegate to service and map domain object to DTO
    return FloorResponse.fromDomain(
        service.update(id, request.name(), request.level(), request.slug()));
  }

  @DeleteMapping("/floors/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    // Delegate to service
    service.softDelete(id);
  }

  // Exception Handlers for mapping application/domain exceptions to HTTP Problem Details

  @ExceptionHandler(FloorNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(FloorNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Piso no encontrado");
    // Using a common URI for not found errors, specific detail in message
    problem.setType(URI.create("https://mapit.local/problems/resource-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler({FloorSlugAlreadyExistsException.class, FloorLevelAlreadyExistsException.class})
  ResponseEntity<ProblemDetail> handleConflict(RuntimeException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Conflicto en piso");
    // Using a common URI for conflict errors
    problem.setType(URI.create("https://mapit.local/problems/resource-conflict"));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(FloorHasActiveSectorsException.class)
  ResponseEntity<ProblemDetail> handleHasSectors(FloorHasActiveSectorsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Piso con sectores activos");
    // Specific URI for this type of conflict
    problem.setType(URI.create("https://mapit.local/problems/floor-has-active-sectors"));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(EstablishmentNotFoundException.class)
  ResponseEntity<ProblemDetail> handleEstablishmentNotFound(
      EstablishmentNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Establecimiento no encontrado");
    problem.setType(URI.create("https://mapit.local/problems/establishment-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleInvalidDomainValue(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Datos inválidos");
    problem.setType(URI.create("https://mapit.local/problems/invalid-input"));
    return ResponseEntity.badRequest().body(problem);
  }

  /** Payload de alta. Level y slug son opcionales. */
  public record FloorCreateRequest(
      @NotBlank @Size(max = 100) String name,
      @Min(1) @Max(999) Integer level, // Optional Integer for level
      @Pattern(regexp = SLUG_REGEX) @Size(min = 2, max = 64) String slug) {}

  /** Payload de edición. Todos opcionales (pero al menos uno debe enviarse). */
  public record FloorUpdateRequest(
      @Size(max = 100) String name,
      @Min(1) @Max(999) Integer level, // Optional Integer for level
      @Pattern(regexp = SLUG_REGEX) @Size(min = 2, max = 64) String slug) {}

  /** Payload de salida. No expone deletedAt ni tenantId. */
  public record FloorResponse(
      UUID id,
      String name,
      int level,
      String slug,
      UUID establishmentId,
      Instant createdAt,
      UUID createdBy,
      Instant updatedAt,
      UUID updatedBy) {

    static FloorResponse fromDomain(Floor floor) {
      return new FloorResponse(
          floor.id(),
          floor.name(),
          floor.level(),
          floor.slug() != null ? floor.slug().value() : null, // Get value from Slug VO
          floor.establishmentId(),
          floor.audit().createdAt(),
          floor.audit().createdBy(),
          floor.audit().updatedAt(),
          floor.audit().updatedBy());
    }
  }
}
