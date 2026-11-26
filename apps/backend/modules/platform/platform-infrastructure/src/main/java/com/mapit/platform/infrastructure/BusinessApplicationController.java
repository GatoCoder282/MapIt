package com.mapit.platform.infrastructure;

import java.net.URI;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.BusinessApplicationRateLimited;
import com.mapit.platform.application.BusinessApplicationsDisabled;
import com.mapit.platform.application.SubmitBusinessApplication;
import com.mapit.platform.domain.BusinessVertical;

/** Solo confirma recepción; nunca expone el id, estado ni tenant de una solicitud. */
@RestController
@RequestMapping("/api/v1/public/business-applications")
class BusinessApplicationController {

  private final SubmitBusinessApplication service;

  BusinessApplicationController(SubmitBusinessApplication service) {
    this.service = service;
  }

  @PostMapping
  ResponseEntity<Void> submit(@Valid @RequestBody CreateRequest request, HttpServletRequest http) {
    service.submit(
        request.businessName(), request.vertical(), request.location(), request.contactName(),
        request.contactEmail(), request.contactPhone(), http.getRemoteAddr());
    return ResponseEntity.accepted().build();
  }

  @PostMapping("/verify-contact")
  ResponseEntity<Void> verify(@Valid @RequestBody VerificationRequest request, HttpServletRequest http) {
    service.verifyContact(request.token(), http.getRemoteAddr());
    return ResponseEntity.accepted().build();
  }

  @ExceptionHandler(BusinessApplicationsDisabled.class)
  ResponseEntity<ProblemDetail> disabled(BusinessApplicationsDisabled failure) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, failure.getMessage());
    problem.setTitle("Solicitudes no disponibles");
    problem.setType(URI.create("https://mapit.local/problems/business-applications-disabled"));
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
  }

  @ExceptionHandler(BusinessApplicationRateLimited.class)
  ResponseEntity<ProblemDetail> limited(BusinessApplicationRateLimited failure) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, failure.getMessage());
    problem.setTitle("Límite de solicitudes excedido");
    problem.setType(URI.create("https://mapit.local/problems/business-applications-rate-limited"));
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .header(HttpHeaders.RETRY_AFTER, Integer.toString(failure.retryAfterSeconds()))
        .body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException failure) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, failure.getMessage());
    problem.setTitle("Solicitud inválida");
    return ResponseEntity.badRequest().body(problem);
  }

  record CreateRequest(
      @NotBlank @Size(min = 2, max = 120) String businessName,
      @NotNull BusinessVertical vertical,
      @NotBlank @Size(min = 2, max = 200) String location,
      @NotBlank @Size(min = 2, max = 120) String contactName,
      @NotBlank @Email @Size(max = 254) String contactEmail,
      @Nullable @Size(min = 6, max = 32) String contactPhone) {}

  record VerificationRequest(@NotBlank @Size(min = 32, max = 200) String token) {}
}
