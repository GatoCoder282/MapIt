package com.mapit.spaces.infrastructure.sector;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;

/** Mapeo JPA del sector. Separado del record dominio para que spaces-domain no importe JPA. */
@Entity
@Table(name = "sector")
public class SectorJpaEntity {

  @Id private UUID id;

  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(name = "floor_id", nullable = false)
  private UUID floorId;

  @Column(name = "name", nullable = false, length = 100)
  private String name;

  @Column(name = "slug", nullable = false, length = 63)
  private String slug;

  @Column(name = "max_capacity", nullable = false)
  private Integer maxCapacity;

  // HU-4.01: colocación dentro del lienzo de la planta + dimensiones intrínsecas.
  @Column(name = "x", nullable = false)
  private double placementX;

  @Column(name = "y", nullable = false)
  private double placementY;

  @Column(name = "rotation", nullable = false)
  private double rotation;

  @Column(name = "width", nullable = false)
  private double width;

  @Column(name = "height", nullable = false)
  private double height;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  protected SectorJpaEntity() {}

  private SectorJpaEntity(
      UUID id,
      String tenantId,
      UUID floorId,
      String name,
      String slug,
      Integer maxCapacity,
      double placementX,
      double placementY,
      double rotation,
      double width,
      double height,
      Instant createdAt,
      Instant updatedAt,
      Instant deletedAt) {
    this.id = id;
    this.tenantId = tenantId;
    this.floorId = floorId;
    this.name = name;
    this.slug = slug;
    this.maxCapacity = maxCapacity;
    this.placementX = placementX;
    this.placementY = placementY;
    this.rotation = rotation;
    this.width = width;
    this.height = height;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }

  static SectorJpaEntity fromDomain(Sector sector) {
    AuditTrail audit = sector.audit();
    return new SectorJpaEntity(
        sector.id().value(),
        sector.tenantId().value(),
        sector.floorId(),
        sector.name(),
        sector.slug().value(),
        sector.maxCapacity(),
        sector.placement().x(),
        sector.placement().y(),
        sector.placement().rotation(),
        sector.geometry().width(),
        sector.geometry().height(),
        audit.createdAt(),
        audit.updatedAt(),
        audit.deletedAt());
  }

  Sector toDomain() {
    AuditTrail audit = new AuditTrail(createdAt, null, updatedAt, null, deletedAt, null);
    return new Sector(
        SectorId.of(id),
        TenantId.of(tenantId),
        floorId,
        name,
        maxCapacity,
        Slug.of(slug),
        Geometry.of(width, height),
        Placement.of(placementX, placementY, rotation),
        audit);
  }
}
