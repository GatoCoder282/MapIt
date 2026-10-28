package com.mapit.operations.infrastructure.audit;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.operations.application.audit.ListAuditLogs;
import com.mapit.operations.domain.audit.AuditLog;
import com.mapit.operations.domain.audit.AuditLogPage;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.http.ApiPaths;

/** Adaptador REST de la consulta administrativa de auditoría. */
@RestController
@RequestMapping(ApiPaths.AUDIT_LOGS)
public class AuditLogController {

  private static final String INVALID_AUDIT_QUERY =
      "https://mapit.local/problems/invalid-audit-query";

  private final ListAuditLogs listAuditLogs;

  public AuditLogController(ListAuditLogs listAuditLogs) {
    this.listAuditLogs = listAuditLogs;
  }

  @GetMapping
  public AuditLogPageResponse list(
      @RequestParam(required = false) AuditResourceType resourceType,
      @RequestParam(required = false) AuditEventType eventType,
      @RequestParam(required = false) UUID resourceId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
          Instant from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(ListAuditLogs.MAX_PAGE_SIZE) int size) {
    return AuditLogPageResponse.from(
        listAuditLogs.execute(resourceType, eventType, resourceId, from, to, page, size));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleInvalidQuery(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Consulta de auditoría inválida");
    problem.setType(URI.create(INVALID_AUDIT_QUERY));
    return ResponseEntity.badRequest().body(problem);
  }

  public record AuditLogEntryResponse(
      UUID id,
      UUID actorId,
      Instant occurredAt,
      AuditResourceType resourceType,
      UUID resourceId,
      AuditEventType eventType,
      Map<String, String> details) {

    static AuditLogEntryResponse from(AuditLog entry) {
      return new AuditLogEntryResponse(
          entry.id(),
          entry.actorId(),
          entry.occurredAt(),
          entry.resourceType(),
          entry.resourceId(),
          entry.eventType(),
          entry.details());
    }
  }

  public record AuditLogPageResponse(
      List<AuditLogEntryResponse> content,
      int page,
      int size,
      long totalElements,
      int totalPages) {

    static AuditLogPageResponse from(AuditLogPage result) {
      return new AuditLogPageResponse(
          result.content().stream().map(AuditLogEntryResponse::from).toList(),
          result.page(),
          result.size(),
          result.totalElements(),
          result.totalPages());
    }
  }
}
