package com.mapit.platform.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.RegisterTenantCommand;
import com.mapit.platform.application.TenantConfirmationEmailException;
import com.mapit.platform.application.TenantNotFoundException;
import com.mapit.platform.application.TenantService;
import com.mapit.platform.application.TenantSlugAlreadyExistsException;
import com.mapit.platform.application.UpdateTenantCommand;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantPage;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.http.ApiPaths;

/**
 * Adaptador REST de la administración de tenants.
 *
 * <p>Toda la ruta requiere rol SUPER_ADMIN (lo impone SecurityConfig en bootstrap):
 * es operación de plataforma, no de un tenant. La tabla es global y sin RLS por
 * diseño (ADR-0004); la única barrera deliberada aquí es la autorización por rol.
 */
@RestController
@RequestMapping(ApiPaths.TENANTS)
public class TenantController {

  private static final String SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final TenantService service;

  public TenantController(TenantService service) {
    this.service = service;
  }

  @GetMapping
  public TenantPageResponse list(
      @RequestParam(required = false) @Size(max = 120) String search,
      @RequestParam(required = false) TenantStatus status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(TenantService.MAX_PAGE_SIZE) int size) {
    TenantPage result = service.search(search, status, page, size);
    return TenantPageResponse.fromDomain(result);
  }

  @GetMapping("/{tenantId}")
  public TenantResponse getById(@PathVariable @Size(min = 2, max = 63) String tenantId) {
    return TenantResponse.fromDomain(service.detail(tenantId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TenantResponse create(@Valid @RequestBody TenantRequest request) {
    return TenantResponse.fromDomain(
        service.register(
            new RegisterTenantCommand(
                request.name(), request.slug(), request.vertical(), request.administratorEmail())));
  }

  /**
   * Edición parcial. El cuerpo no incluye slug ni vertical: son inmutables por
   * dominio y el contrato los excluye; si llegan, no hay setter que los capture.
   */
  @PatchMapping("/{tenantId}")
  public TenantResponse update(
      @PathVariable @Size(min = 2, max = 63) String tenantId,
      @Valid @RequestBody TenantUpdateRequest request) {
    return TenantResponse.fromDomain(
        service.update(new UpdateTenantCommand(tenantId, request.name(), request.status())));
  }

  @ExceptionHandler(TenantNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(TenantNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Tenant no encontrado");
    problem.setType(URI.create(TenantProblemTypes.TENANT_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleDomainValidation(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Solicitud inválida");
    problem.setType(URI.create(TenantProblemTypes.INVALID_REQUEST));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
  }

  @ExceptionHandler(TenantSlugAlreadyExistsException.class)
  ResponseEntity<ProblemDetail> handleSlugConflict(TenantSlugAlreadyExistsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("El slug ya está registrado");
    problem.setType(URI.create(TenantProblemTypes.SLUG_CONFLICT));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(TenantConfirmationEmailException.class)
  ResponseEntity<ProblemDetail> handleEmailFailure(TenantConfirmationEmailException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage());
    problem.setTitle("No se pudo enviar la confirmación");
    problem.setType(URI.create(TenantProblemTypes.CONFIRMATION_UNAVAILABLE));
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
  }

  /** Payload de entrada del registro; el correo se usa después para la notificación. */
  public record TenantRequest(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(min = 2, max = 63) @Pattern(regexp = SLUG_PATTERN) String slug,
      @NotNull BusinessVertical vertical,
      @NotBlank @Email @Size(max = 254) String administratorEmail) {}

  /**
   * Edición parcial: solo nombre y estado. Sin slug ni vertical: son inmutables
   * por dominio y no se exponen ni de adorno.
   */
  public record TenantUpdateRequest(
      @Size(min = 1, max = 120) String name, TenantStatus status) {}

  /** Payload de salida sin exponer el correo operativo del administrador. */
  public record TenantResponse(
      String id,
      String name,
      String slug,
      BusinessVertical vertical,
      TenantStatus status,
      Instant createdAt,
      Instant updatedAt) {

    static TenantResponse fromDomain(Tenant tenant) {
      return new TenantResponse(
          tenant.id().value(),
          tenant.name(),
          tenant.slug(),
          tenant.vertical(),
          tenant.status(),
          tenant.createdAt(),
          tenant.updatedAt());
    }
  }

  /** Página del listado de plataforma, alineada con el contrato TenantPage. */
  public record TenantPageResponse(
      List<TenantResponse> content, int page, int size, long totalElements, int totalPages) {

    static TenantPageResponse fromDomain(TenantPage page) {
      return new TenantPageResponse(
          page.content().stream().map(TenantResponse::fromDomain).toList(),
          page.page(),
          page.size(),
          page.totalElements(),
          page.totalPages());
    }
  }
}
