package com.mapit.spaces.infrastructure.template;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.domain.template.ElementTemplate;
import com.mapit.spaces.domain.template.ElementTemplateId;

/**
 * Mapeo JPA de la plantilla de elemento. Separado del record de dominio para que
 * spaces-domain no importe JPA. Mismo patrón que {@code SpaceElementJpaEntity}.
 */
@Entity
@Table(name = "element_template")
public class ElementTemplateJpaEntity {

  @Id private UUID id;

  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(name = "name", nullable = false, length = 100)
  private String name;

  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  protected ElementTemplateJpaEntity() {}

  private ElementTemplateJpaEntity(
      UUID id,
      String tenantId,
      String name,
      String type,
      Instant createdAt,
      Instant updatedAt,
      Instant deletedAt) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }

  static ElementTemplateJpaEntity fromDomain(ElementTemplate template) {
    AuditTrail audit = template.audit();
    return new ElementTemplateJpaEntity(
        template.id().value(),
        template.tenantId().value(),
        template.name(),
        template.type().name(),
        audit.createdAt(),
        audit.updatedAt(),
        audit.deletedAt());
  }

  ElementTemplate toDomain() {
    AuditTrail audit = new AuditTrail(createdAt, null, updatedAt, null, deletedAt, null);
    return new ElementTemplate(
        ElementTemplateId.of(id),
        TenantId.of(tenantId),
        name,
        SpaceElementType.valueOf(type),
        audit);
  }
}
