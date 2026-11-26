package com.mapit.platform.infrastructure;

import java.net.URI;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.ObserveTenants;
import com.mapit.platform.application.TenantObservabilityDisabled;
import com.mapit.platform.domain.TenantStatus;

/** Solo lectura; SecurityConfig exige SUPER_ADMIN antes de este controlador. */
@RestController
@Validated
@RequestMapping("/api/v1/platform/observability")
class TenantObservabilityController {

  private static final String PROBLEMS = "https://mapit.local/problems/";

  private final ObserveTenants observe;

  TenantObservabilityController(ObserveTenants observe) {
    this.observe = observe;
  }

  @GetMapping
  ObserveTenants.Overview overview(@RequestParam(defaultValue = "7") int days) {
    return observe.overview(days);
  }

  @GetMapping("/tenants")
  ObserveTenants.TenantPage tenants(
      @RequestParam(defaultValue = "7") int days,
      @RequestParam(required = false) @Nullable @Size(max = 120) String search,
      @RequestParam(required = false) @Nullable TenantStatus status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
    return observe.tenants(days, search, status, page, size);
  }

  @GetMapping("/tenants/{slug}")
  ResponseEntity<?> tenant(@PathVariable String slug, @RequestParam(defaultValue = "7") int days) {
    return observe
        .tenant(slug, days)
        .<ResponseEntity<?>>map(ResponseEntity::ok)
        .orElseGet(() -> problem(HttpStatus.NOT_FOUND, "tenant-not-found", "Empresa no encontrada"));
  }

  @ExceptionHandler(TenantObservabilityDisabled.class)
  ResponseEntity<ProblemDetail> disabled(TenantObservabilityDisabled failure) {
    return problem(HttpStatus.NOT_FOUND, "tenant-observability-disabled", failure.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException failure) {
    return problem(HttpStatus.BAD_REQUEST, "tenant-observability-invalid", failure.getMessage());
  }

  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create(PROBLEMS + type));
    return ResponseEntity.status(status).body(problem);
  }
}
