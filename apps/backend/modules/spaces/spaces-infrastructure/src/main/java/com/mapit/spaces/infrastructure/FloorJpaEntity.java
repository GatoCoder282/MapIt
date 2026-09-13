package com.mapit.spaces.infrastructure;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Floor;
import com.mapit.spaces.domain.Slug;

/**
 * Mapeo JPA del piso. No se filtra hacia el dominio.
 */
@Entity
@Table(name = "floor")
public class FloorJpaEntity {

  @Id
  private UUID id;

  // Tenant ID is stored as text (VARCHAR or similar) in PostgreSQL for RLS compatibility
  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(name = "establishment_id", nullable = false)
  private UUID establishmentId;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false)
  private Integer level;

  @Column(length = 64)
  private String slug;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "created_by", updatable = false)
  private UUID createdBy;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "updated_by")
  private UUID updatedBy;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @Column(name = "deleted_by")
  private UUID deletedBy;

  // Default constructor for JPA
  protected FloorJpaEntity() {}

  private FloorJpaEntity(
      UUID id,
      String tenantId,
      UUID establishmentId,
      String name,
      Integer level,
      String slug,
      Instant createdAt,
      UUID createdBy,
      Instant updatedAt,
      UUID updatedBy,
      Instant deletedAt,
      UUID deletedBy) {
    this.id = id;
    this.tenantId = tenantId;
    this.establishmentId = establishmentId;
    this.name = name;
    this.level = level;
    this.slug = slug;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
    this.updatedAt = updatedAt;
    this.updatedBy = updatedBy;
    this.deletedAt = deletedAt;
    this.deletedBy = deletedBy;
  }

  public static FloorJpaEntity fromDomain(Floor floor) {
    AuditTrail audit = floor.audit();
    return new FloorJpaEntity(
        floor.id(),
        floor.tenantId().value(), // Convert TenantId to String
        floor.establishmentId(),
        floor.name(),
        floor.level(),
        floor.slug() != null ? floor.slug().value() : null, // Convert Slug value
        audit.createdAt(),
        audit.createdBy(),
        audit.updatedAt(),
        audit.updatedBy(),
        audit.deletedAt(),
        audit.deletedBy());
  }

  public Floor toDomain() {
    return new Floor(
        id,
        TenantId.of(tenantId), // Convert String back to TenantId
        establishmentId,
        name,
        level,
        slug != null ? Slug.of(slug) : null, // Convert String back to Slug
        new AuditTrail(createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy));
  }

  // Getters for Spring Data JPA (essential for some operations and mapping)
  public UUID getId() { return id; }
  public String getTenantId() { return tenantId; }
  public UUID getEstablishmentId() { return establishmentId; }
  public String getName() { return name; }
  public Integer getLevel() { return level; }
  public String getSlug() { return slug; }
  public Instant getCreatedAt() { return createdAt; }
  public UUID getCreatedBy() { return createdBy; }
  public Instant getUpdatedAt() { return updatedAt; }
  public UUID getUpdatedBy() { return updatedBy; }
  public Instant getDeletedAt() { return deletedAt; }
  public UUID getDeletedBy() { return deletedBy; }

  // Setters would typically be needed for JPA entities, but for immutability
  // and mapping from domain, we primarily use the constructor and static methods.
  // Spring Data JPA can often manage with private constructors and getters/setters
  // or direct field access if configured. Providing them for robustness.
  public void setId(UUID id) { this.id = id; }
  public void setTenantId(String tenantId) { this.tenantId = tenantId; }
  public void setEstablishmentId(UUID establishmentId) { this.establishmentId = establishmentId; }
  public void setName(String name) { this.name = name; }
  public void setLevel(Integer level) { this.level = level; }
  public void setSlug(String slug) { this.slug = slug; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
  public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
  public void setDeletedBy(UUID deletedBy) { this.deletedBy = deletedBy; }
}
