package com.mapit.platform.domain;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Solicitud de incorporación, aislada en el tenant técnico hasta la decisión. */
public record BusinessApplication(
    UUID id,
    TenantId tenantId,
    String businessName,
    BusinessVertical vertical,
    String location,
    String contactName,
    String contactEmail,
    @Nullable String contactPhone,
    BusinessApplicationStatus status,
    @Nullable Instant contactVerifiedAt,
    @Nullable UUID decidedBy,
    @Nullable Instant decidedAt,
    @Nullable String rejectionReason,
    @Nullable TenantId approvedTenantId,
    Instant createdAt,
    Instant updatedAt) {

  public static final TenantId PLATFORM = TenantId.of("platform");

  public BusinessApplication {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(tenantId, "tenantId");
    Objects.requireNonNull(vertical, "vertical");
    Objects.requireNonNull(status, "status");
    Objects.requireNonNull(createdAt, "createdAt");
    Objects.requireNonNull(updatedAt, "updatedAt");
    if (!PLATFORM.equals(tenantId)) {
      throw new IllegalArgumentException("La solicitud debe pertenecer a platform");
    }
    businessName = requiredText(businessName, 2, 120, "businessName");
    location = requiredText(location, 2, 200, "location");
    contactName = requiredText(contactName, 2, 120, "contactName");
    contactEmail = requiredText(contactEmail, 3, 254, "contactEmail").toLowerCase(Locale.ROOT);
    if (!contactEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
      throw new IllegalArgumentException("contactEmail inválido");
    }
    if (contactPhone != null) {
      contactPhone = requiredText(contactPhone, 6, 32, "contactPhone");
    }
    if (updatedAt.isBefore(createdAt)
        || (contactVerifiedAt != null && contactVerifiedAt.isBefore(createdAt))
        || (decidedAt != null && decidedAt.isBefore(createdAt))) {
      throw new IllegalArgumentException("Las fechas no pueden preceder a la solicitud");
    }
    switch (status) {
      case PENDING -> {
        if (decidedBy != null || decidedAt != null || rejectionReason != null || approvedTenantId != null) {
          throw new IllegalArgumentException("Una solicitud pendiente no tiene decisión");
        }
      }
      case APPROVED -> {
        if (contactVerifiedAt == null || decidedBy == null || decidedAt == null
            || rejectionReason != null || approvedTenantId == null || PLATFORM.equals(approvedTenantId)) {
          throw new IllegalArgumentException("La aprobación requiere contacto verificado, actor y tenant");
        }
      }
      case REJECTED -> {
        if (decidedBy == null || decidedAt == null || approvedTenantId != null) {
          throw new IllegalArgumentException("El rechazo requiere actor y fecha, sin tenant");
        }
        rejectionReason = requiredText(rejectionReason, 1, 500, "rejectionReason");
      }
    }
  }

  public static BusinessApplication pending(
      UUID id,
      String businessName,
      BusinessVertical vertical,
      String location,
      String contactName,
      String contactEmail,
      @Nullable String contactPhone,
      Instant now) {
    return new BusinessApplication(
        id, PLATFORM, businessName, vertical, location, contactName, contactEmail,
        contactPhone, BusinessApplicationStatus.PENDING, null, null, null, null, null, now, now);
  }

  /** El caso de uso comprueba el token antes de invocar esta transición. */
  public BusinessApplication verifyContact(Instant now) {
    if (status != BusinessApplicationStatus.PENDING) {
      throw new IllegalStateException("Solo una solicitud pendiente puede verificar el contacto");
    }
    if (contactVerifiedAt != null) {
      return this;
    }
    return new BusinessApplication(
        id, tenantId, businessName, vertical, location, contactName, contactEmail,
        contactPhone, status, now, null, null, null, null, createdAt, now);
  }

  public BusinessApplication approve(UUID actor, TenantId createdTenant, Instant now) {
    Objects.requireNonNull(actor, "actor");
    Objects.requireNonNull(createdTenant, "createdTenant");
    if (status == BusinessApplicationStatus.APPROVED && createdTenant.equals(approvedTenantId)) {
      return this;
    }
    if (status != BusinessApplicationStatus.PENDING || contactVerifiedAt == null) {
      throw new IllegalStateException("La solicitud debe estar pendiente y verificada");
    }
    return new BusinessApplication(
        id, tenantId, businessName, vertical, location, contactName, contactEmail,
        contactPhone, BusinessApplicationStatus.APPROVED, contactVerifiedAt, actor, now,
        null, createdTenant, createdAt, now);
  }

  public BusinessApplication reject(UUID actor, String reason, Instant now) {
    Objects.requireNonNull(actor, "actor");
    if (status != BusinessApplicationStatus.PENDING) {
      throw new IllegalStateException("Solo una solicitud pendiente puede rechazarse");
    }
    return new BusinessApplication(
        id, tenantId, businessName, vertical, location, contactName, contactEmail,
        contactPhone, BusinessApplicationStatus.REJECTED, contactVerifiedAt, actor, now,
        reason, null, createdAt, now);
  }

  private static String requiredText(@Nullable String value, int min, int max, String field) {
    if (value == null) {
      throw new IllegalArgumentException(field + " es obligatorio");
    }
    String normalized = value.trim();
    if (normalized.length() < min || normalized.length() > max) {
      throw new IllegalArgumentException(field + " debe tener entre " + min + " y " + max + " caracteres");
    }
    return normalized;
  }
}
