package com.mapit.payments.infrastructure;

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
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.MockQrConfigurationService;
import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;

/** ADMIN por SecurityConfig; entorno y tenant se validan nuevamente en application. */
@RestController
@RequestMapping("/api/v1/payment-methods/mock-qr")
public class MockQrConfigurationController {
  private final MockQrConfigurationService service;
  public MockQrConfigurationController(MockQrConfigurationService service) { this.service = service; }

  @GetMapping
  public List<Response> list() { return service.list().stream().map(Response::from).toList(); }
  @GetMapping("/countries")
  public List<MockQrConfigurationService.Country> countries() { return service.countries(); }
  @GetMapping("/{configurationId}")
  public Response get(@PathVariable UUID configurationId) { return Response.from(service.get(configurationId)); }
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Response create(@Valid @RequestBody Write request) { return Response.from(service.create(request.draft())); }
  @PutMapping("/{configurationId}")
  public Response update(@PathVariable UUID configurationId, @Valid @RequestBody Write request) {
    return Response.from(service.update(configurationId, request.draft()));
  }
  @PostMapping("/{configurationId}/regenerate")
  public Response regenerate(@PathVariable UUID configurationId) { return Response.from(service.regenerate(configurationId)); }

  @ExceptionHandler({MockQrConfigurationService.NotFound.class, MockQrConfigurationService.Disabled.class})
  ResponseEntity<ProblemDetail> unavailable(RuntimeException exception) {
    return problem(HttpStatus.NOT_FOUND, "mock-qr-not-found", "Configuración de prueba no disponible");
  }
  @ExceptionHandler(MockQrConfigurationRepository.Duplicate.class)
  ResponseEntity<ProblemDetail> conflict() {
    return problem(HttpStatus.CONFLICT, "mock-qr-duplicate", "Ya existe una configuración QR de prueba para este establecimiento");
  }
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid() {
    return problem(HttpStatus.BAD_REQUEST, "mock-qr-invalid", "Completa establecimiento, país ISO y datos de prueba requeridos");
  }
  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
    var problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create("https://mapit.dev/problems/" + type));
    return ResponseEntity.status(status).body(problem);
  }

  public record Write(@NotNull UUID establishmentId, @NotBlank @Pattern(regexp="[A-Z]{2}") String country,
      @NotBlank @Size(max=120) String bankName, @NotBlank @Size(max=120) String accountHolderName,
      @NotBlank @Size(max=120) String accountReference, @NotNull Boolean enabled) {
    MockQrConfigurationService.Draft draft() {
      return new MockQrConfigurationService.Draft(establishmentId, country, bankName, accountHolderName, accountReference, Boolean.TRUE.equals(enabled));
    }
  }
  public record Response(UUID id, UUID establishmentId, String country, String bankName, String accountHolderName,
      String accountReference, boolean enabled, UUID simulationToken, String simulationPath, Instant createdAt, Instant updatedAt) {
    static Response from(MockQrConfiguration c) {
      return new Response(c.id(), c.establishmentId(), c.country(), c.bankName(), c.accountHolderName(), c.accountReference(),
          c.enabled(), c.simulationToken(), c.simulationPath(), c.createdAt(), c.updatedAt());
    }
  }
}
