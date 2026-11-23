package com.mapit.identity.infrastructure;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.StartAdminRecovery;

/** Ruta de plataforma deshabilitada hasta disponer de una fuente de aprobación real. */
@RestController
@RequestMapping("/api/v1/platform/admin-recoveries")
@ConditionalOnProperty(name = "mapit.admin-recovery.operator-endpoint-enabled", havingValue = "true")
public class AdminRecoveryController {
  private final StartAdminRecovery start;

  public AdminRecoveryController(StartAdminRecovery start) {
    this.start = start;
  }

  @PostMapping
  public ResponseEntity<Receipt> create(@RequestHeader(HttpHeaders.AUTHORIZATION) String bearer,
      @Valid @RequestBody Request body) {
    if (!bearer.startsWith("Bearer ")) throw new SecurityException("Credencial inválida");
    UUID id = start.execute(bearer.substring(7).strip(),
        new StartAdminRecovery.Request(body.tenantId(), body.tenantSlug(), body.targetUserId(),
            body.ticket(), body.reason(), body.approvalReference()));
    return ResponseEntity.accepted().body(new Receipt(id));
  }

  @ExceptionHandler(SecurityException.class)
  ResponseEntity<ProblemDetail> forbidden(SecurityException ignored) {
    return problem(HttpStatus.FORBIDDEN, "Recuperación no autorizada");
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException ignored) {
    return problem(HttpStatus.BAD_REQUEST, "Solicitud inválida");
  }

  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String title) {
    ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, title);
    detail.setTitle(title);
    detail.setType(URI.create("https://mapit.local/problems/admin-recovery"));
    return ResponseEntity.status(status).body(detail);
  }

  public record Request(@NotBlank @Size(min = 2, max = 63) String tenantId,
      @NotBlank @Size(min = 2, max = 63) String tenantSlug,
      @NotNull UUID targetUserId,
      @NotBlank @Size(max = 120) String ticket,
      @NotBlank @Size(max = 500) String reason,
      @NotBlank @Size(max = 240) String approvalReference) {}

  public record Receipt(UUID authorizationId) {}
}
