package com.mapit.platform.infrastructure;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.tenant.TenantId;

/** Mapeo JPA de la tabla global {@code tenant}. */
@Entity
@Table(name = "tenant")
class TenantJpaEntity {

  @Id
  @Column(name = "id", nullable = false, length = 63)
  private String id;

  @Column(name = "name", nullable = false, length = 120)
  private String name;

  @Column(name = "slug", nullable = false, length = 63, unique = true)
  private String slug;

  @Enumerated(EnumType.STRING)
  @Column(name = "vertical", nullable = false, length = 20)
  private BusinessVertical vertical;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 16)
  private TenantStatus status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected TenantJpaEntity() {
    // Constructor requerido por JPA.
  }

  private TenantJpaEntity(
      String id,
      String name,
      String slug,
      BusinessVertical vertical,
      TenantStatus status,
      Instant createdAt,
      Instant updatedAt) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.vertical = vertical;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static TenantJpaEntity fromDomain(Tenant tenant) {
    return new TenantJpaEntity(
        tenant.id().value(),
        tenant.name(),
        tenant.slug(),
        tenant.vertical(),
        tenant.status(),
        tenant.createdAt(),
        tenant.updatedAt());
  }

  Tenant toDomain() {
    return new Tenant(
        TenantId.of(id), name, slug, vertical, status, createdAt, updatedAt);
  }
}
