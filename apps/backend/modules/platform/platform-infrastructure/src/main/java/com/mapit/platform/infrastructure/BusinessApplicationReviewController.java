package com.mapit.platform.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.BusinessApplicationDecisionConflict;
import com.mapit.platform.application.BusinessApplicationNotFound;
import com.mapit.platform.application.DecideBusinessApplication;
import com.mapit.platform.application.ReviewBusinessApplications;
import com.mapit.platform.application.TenantConfirmationEmailException;
import com.mapit.platform.application.TenantSlugAlreadyExistsException;
import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationPage;
import com.mapit.platform.domain.BusinessApplicationStatus;
import com.mapit.platform.domain.BusinessVertical;

/** Bandeja de plataforma; SecurityConfig exige SUPER_ADMIN antes de este controlador. */
@RestController
@Validated
@RequestMapping("/api/v1/business-applications")
class BusinessApplicationReviewController {
  private final ReviewBusinessApplications review;
  private final DecideBusinessApplication decisions;

  BusinessApplicationReviewController(ReviewBusinessApplications review, DecideBusinessApplication decisions) {
    this.review = review;
    this.decisions = decisions;
  }

  @GetMapping
  PageResponse search(
      @RequestParam(required = false) @Size(max = 120) String search,
      @RequestParam(required = false) BusinessApplicationStatus status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    BusinessApplicationPage result = review.search(search, status, page, size);
    return new PageResponse(result.content().stream().map(DetailResponse::from).toList(),
        result.page(), result.size(), result.totalElements(), result.totalPages());
  }

  @GetMapping("/{id}")
  DetailResponse detail(@PathVariable UUID id) {
    return DetailResponse.from(review.detail(id));
  }

  @PostMapping("/{id}/approve")
  DetailResponse approve(@PathVariable UUID id, @Valid @RequestBody ApprovalRequest request) {
    return DetailResponse.from(decisions.approve(id, request.slug()));
  }

  @PostMapping("/{id}/reject")
  DetailResponse reject(@PathVariable UUID id, @Valid @RequestBody RejectionRequest request) {
    return DetailResponse.from(decisions.reject(id, request.reason()));
  }

  @ExceptionHandler(BusinessApplicationNotFound.class)
  ResponseEntity<ProblemDetail> notFound(BusinessApplicationNotFound failure) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, failure.getMessage()));
  }

  @ExceptionHandler({BusinessApplicationDecisionConflict.class, TenantSlugAlreadyExistsException.class})
  ResponseEntity<ProblemDetail> conflict(RuntimeException failure) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, failure.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException failure) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, failure.getMessage()));
  }

  @ExceptionHandler(TenantConfirmationEmailException.class)
  ResponseEntity<ProblemDetail> onboardingUnavailable(TenantConfirmationEmailException failure) {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
            "No se pudo enviar la invitación al administrador"));
  }

  record ApprovalRequest(@NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String slug) {}

  record RejectionRequest(@NotBlank @Size(max = 500) String reason) {}

  record PageResponse(List<DetailResponse> content, int page, int size, long totalElements, int totalPages) {}

  record DetailResponse(UUID id, String businessName, BusinessVertical vertical, String location,
      String contactName, String contactEmail, @Nullable String contactPhone,
      BusinessApplicationStatus status, @Nullable Instant contactVerifiedAt,
      @Nullable Instant decidedAt, @Nullable String rejectionReason,
      @Nullable String approvedTenantId, Instant createdAt, Instant updatedAt) {
    static DetailResponse from(BusinessApplication value) {
      return new DetailResponse(value.id(), value.businessName(), value.vertical(), value.location(),
          value.contactName(), value.contactEmail(), value.contactPhone(), value.status(),
          value.contactVerifiedAt(), value.decidedAt(), value.rejectionReason(),
          value.approvedTenantId() == null ? null : value.approvedTenantId().value(),
          value.createdAt(), value.updatedAt());
    }
  }
}
