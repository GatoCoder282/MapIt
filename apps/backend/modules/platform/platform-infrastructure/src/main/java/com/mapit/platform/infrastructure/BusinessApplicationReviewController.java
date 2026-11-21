package com.mapit.platform.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

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

import com.mapit.platform.application.BusinessApplicationNotFound;
import com.mapit.platform.application.ReviewBusinessApplications;
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

  BusinessApplicationReviewController(ReviewBusinessApplications review) {
    this.review = review;
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

  @ExceptionHandler(BusinessApplicationNotFound.class)
  ResponseEntity<ProblemDetail> notFound(BusinessApplicationNotFound failure) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, failure.getMessage()));
  }

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
