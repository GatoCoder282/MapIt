package com.mapit.spaces.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
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

import com.mapit.spaces.application.EstablishmentNotFoundException;
import com.mapit.spaces.application.EstablishmentService;
import com.mapit.spaces.application.EstablishmentSlugAlreadyExistsException;
import com.mapit.spaces.domain.Establishment;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.Slug;

/** Adaptador REST de la gestión de establecimientos (CU-04). */
@RestController
@RequestMapping("/api/v1/establishments")
public class EstablishmentController {

  private static final String SLUG_REGEX = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final EstablishmentService service;

  public EstablishmentController(EstablishmentService service) {
    this.service = service;
  }

  @GetMapping
  public List<EstablishmentResponse> findAll() {
    return service.findAll().stream().map(EstablishmentResponse::fromDomain).toList();
  }

  @GetMapping("/{id}")
  public EstablishmentResponse findById(@PathVariable UUID id) {
    return EstablishmentResponse.fromDomain(service.findById(id));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public EstablishmentResponse create(@Valid @RequestBody EstablishmentCreateRequest request) {
    return EstablishmentResponse.fromDomain(
        service.create(
            request.name(),
            request.type(),
            Slug.of(request.slug()),
            request.timezone()));
  }

  @PutMapping("/{id}")
  public EstablishmentResponse update(
      @PathVariable UUID id, @Valid @RequestBody EstablishmentUpdateRequest request) {
    return EstablishmentResponse.fromDomain(
        service.update(id, request.name(), Slug.of(request.slug()), request.timezone()));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.softDelete(id);
  }

  @ExceptionHandler(EstablishmentNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(EstablishmentNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Establecimiento no encontrado");
    problem.setType(URI.create("https://mapit.local/problems/establishment-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(EstablishmentSlugAlreadyExistsException.class)
  ResponseEntity<ProblemDetail> handleSlugConflict(
      EstablishmentSlugAlreadyExistsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Slug ya utilizado");
    problem.setType(URI.create("https://mapit.local/problems/establishment-slug-conflict"));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  /**
   * Traduce las violaciones de invariantes del dominio a 400.
   *
   * <p>Sin esto, un {@code Slug.of("MAYUSCULAS")} llegaría al cliente como un 500, cuando
   * en realidad es un dato mal enviado.
   */
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleInvalidDomainValue(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Datos inválidos");
    problem.setType(URI.create("https://mapit.local/problems/establishment-invalid"));
    return ResponseEntity.badRequest().body(problem);
  }

  /** Payload de alta. Incluye {@code type}, que solo se puede fijar al crear. */
  public record EstablishmentCreateRequest(
      @NotBlank @Size(max = 120) String name,
      @NotNull EstablishmentType type,
      @NotBlank @Pattern(regexp = SLUG_REGEX) @Size(min = 2, max = 63) String slug,
      @Size(max = 64) String timezone) {}

  /**
   * Payload de edición.
   *
   * <p><strong>Sin {@code type} a propósito</strong>: es inmutable tras la creación (RN-3).
   * Al no existir el campo, el contrato hace cumplir la regla antes que cualquier
   * validación en Java.
   */
  public record EstablishmentUpdateRequest(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = SLUG_REGEX) @Size(min = 2, max = 63) String slug,
      @Size(max = 64) String timezone) {}

  /** Payload de salida. No expone {@code deletedAt} ni {@code tenantId}. */
  public record EstablishmentResponse(
      UUID id,
      String name,
      EstablishmentType type,
      String slug,
      String timezone,
      Instant createdAt,
      UUID createdBy,
      Instant updatedAt,
      UUID updatedBy) {

    static EstablishmentResponse fromDomain(Establishment establishment) {
      return new EstablishmentResponse(
          establishment.id(),
          establishment.name(),
          establishment.type(),
          establishment.slug().value(),
          establishment.timezone(),
          establishment.audit().createdAt(),
          establishment.audit().createdBy(),
          establishment.audit().updatedAt(),
          establishment.audit().updatedBy());
    }
  }
}
