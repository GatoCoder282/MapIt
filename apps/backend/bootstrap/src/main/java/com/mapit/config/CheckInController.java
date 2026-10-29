package com.mapit.config;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.mapit.payments.application.PaymentMethodService;
import com.mapit.payments.application.PaymentService;

@RestController
@RequestMapping("/api/v1/establishments/{establishmentId}/check-ins")
public class CheckInController {
  private final CheckInService checkIns;
  public CheckInController(CheckInService checkIns) { this.checkIns = checkIns; }

  @PostMapping("/lookup")
  public ResponseEntity<CheckInService.Details> lookup(@PathVariable UUID establishmentId, @Valid @RequestBody TokenRequest request) {
    return response(checkIns.lookup(establishmentId, request.token()));
  }
  @PostMapping
  public ResponseEntity<CheckInService.Details> register(@PathVariable UUID establishmentId, @Valid @RequestBody TokenRequest request) {
    return response(checkIns.register(establishmentId, request.token()));
  }
  private ResponseEntity<CheckInService.Details> response(CheckInService.Details details) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer").body(details);
  }
  @ExceptionHandler(PaymentMethodService.NotFound.class)
  ResponseEntity<ProblemDetail> missing() {
    return problem(HttpStatus.NOT_FOUND, "Recurso no encontrado");
  }
  @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
  ResponseEntity<ProblemDetail> forbidden() {
    return problem(HttpStatus.FORBIDDEN, "Operación no autorizada para este establecimiento");
  }
  @ExceptionHandler(PaymentService.Conflict.class)
  ResponseEntity<ProblemDetail> conflict() {
    return problem(HttpStatus.CONFLICT, "La reserva no admite registrar llegada");
  }
  private ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(java.net.URI.create("https://mapit.dev/problems/check-in-" + status.value()));
    return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer").body(problem);
  }
  public record TokenRequest(@NotNull @Pattern(regexp="^[A-Za-z0-9_-]{43}$") String token) {
    @Override public String toString() { return "TokenRequest[REDACTED]"; }
  }
}
