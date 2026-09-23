package com.mapit.spaces.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.SpaceElement;
import com.mapit.spaces.domain.SpaceElementId;
import com.mapit.spaces.domain.SpaceElementType;

/** Mapeo JPA del elemento espacial. Separado del record de dominio para que spaces-domain no
 * importe JPA. El tenant se conserva como columna plana: el aislamiento efectivo lo da la RLS
 * activada en el adaptador con `set_config('app.tenant_id', ?, true)` antes de cada consulta. */
@Entity
@Table(name = "space_element")
public class SpaceElementJpaEntity {

  @Id private UUID id;

  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(name = "sector_id", nullable = false)
  private UUID sectorId;

  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "state", nullable = false)
  private String state;

  @Column(name = "x", nullable = false)
  private Double x;

  @Column(name = "y", nullable = false)
  private Double y;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  protected SpaceElementJpaEntity() {}

  private SpaceElementJpaEntity(
      UUID id,
      String tenantId,
      UUID sectorId,
      String type,
      String state,
      Double x,
      Double y,
      Instant createdAt,
      Instant updatedAt,
      Instant deletedAt) {
    this.id = id;
    this.tenantId = tenantId;
    this.sectorId = sectorId;
    this.type = type;
    this.state = state;
    this.x = x;
    this.y = y;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }

  static SpaceElementJpaEntity fromDomain(SpaceElement element) {
    AuditTrail audit = element.audit();
    return new SpaceElementJpaEntity(
        element.id().value(),
        element.tenantId().value(),
        element.sectorId(),
        element.type().name(),
        element.state().name(),
        element.x(),
        element.y(),
        audit.createdAt(),
        audit.updatedAt(),
        audit.deletedAt());
  }

  SpaceElement toDomain() {
    AuditTrail audit = new AuditTrail(createdAt, null, updatedAt, null, deletedAt, null);
    return new SpaceElement(
        SpaceElementId.of(id),
        TenantId.of(tenantId),
        sectorId,
        SpaceElementType.valueOf(type),
        x,
        y,
        SpaceElementState.valueOf(state),
        audit);
  }
}
