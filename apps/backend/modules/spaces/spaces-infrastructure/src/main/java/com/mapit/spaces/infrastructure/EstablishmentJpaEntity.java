package com.mapit.spaces.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Establishment;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.Slug;

/**
 * Mapeo JPA del establecimiento. No se filtra hacia el dominio.
 *
 * <p>Existe separada de {@link Establishment} para que las reglas de negocio no queden
 * acopladas al esquema de la base: el módulo {@code spaces-domain} ni siquiera declara
 * JPA como dependencia, así que anotar el record ahí no compilaría.
 */
@Entity
@Table(name = "establishment")
public class EstablishmentJpaEntity {

  @Id private UUID id;

  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(nullable = false, length = 120)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, updatable = false)
  private EstablishmentType type;

  @Column(nullable = false, length = 63)
  private String slug;

  @Column(nullable = false, length = 64)
  private String timezone;

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

  protected EstablishmentJpaEntity() {}

  private EstablishmentJpaEntity(
      UUID id,
      String tenantId,
      String name,
      EstablishmentType type,
      String slug,
      String timezone,
      Instant createdAt,
      UUID createdBy,
      Instant updatedAt,
      UUID updatedBy,
      Instant deletedAt,
      UUID deletedBy) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.type = type;
    this.slug = slug;
    this.timezone = timezone;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
    this.updatedAt = updatedAt;
    this.updatedBy = updatedBy;
    this.deletedAt = deletedAt;
    this.deletedBy = deletedBy;
  }

  static EstablishmentJpaEntity fromDomain(Establishment establishment) {
    AuditTrail audit = establishment.audit();
    return new EstablishmentJpaEntity(
        establishment.id(),
        establishment.tenantId().value(),
        establishment.name(),
        establishment.type(),
        establishment.slug().value(),
        establishment.timezone(),
        audit.createdAt(),
        audit.createdBy(),
        audit.updatedAt(),
        audit.updatedBy(),
        audit.deletedAt(),
        audit.deletedBy());
  }

  Establishment toDomain() {
    return new Establishment(
        id,
        TenantId.of(tenantId),
        name,
        type,
        Slug.of(slug),
        timezone,
        new AuditTrail(createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy));
  }
}
