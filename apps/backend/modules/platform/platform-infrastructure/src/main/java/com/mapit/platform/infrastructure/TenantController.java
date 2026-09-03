package com.mapit.platform.infrastructure;

import java.net.URI;
import java.time.Instant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.RegisterTenantCommand;
import com.mapit.platform.application.TenantService;
import com.mapit.platform.application.TenantSlugAlreadyExistsException;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantStatus;

/** Adaptador REST para registrar empresas en la plataforma. */
@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

  private static final String SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final TenantService service;

  public TenantController(TenantService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TenantResponse create(@Valid @RequestBody TenantRequest request) {
    return TenantResponse.fromDomain(
        service.register(new RegisterTenantCommand(request.name(), request.slug(), request.vertical())));
  }

  @ExceptionHandler(TenantSlugAlreadyExistsException.class)
  ResponseEntity<ProblemDetail> handleSlugConflict(TenantSlugAlreadyExistsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("El slug ya está registrado");
    problem.setType(URI.create("https://mapit.local/problems/tenant-slug-conflict"));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  /** Payload de entrada del registro; el correo se usa después para la notificación. */
  public record TenantRequest(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(min = 2, max = 63) @Pattern(regexp = SLUG_PATTERN) String slug,
      @NotNull BusinessVertical vertical,
      @NotBlank @Email @Size(max = 254) String administratorEmail) {}

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
}
