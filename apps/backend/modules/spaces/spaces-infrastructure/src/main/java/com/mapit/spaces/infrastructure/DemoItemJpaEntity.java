package com.mapit.spaces.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.DemoItem;

/** Mapeo JPA del elemento de demostración. No se filtra hacia el dominio. */
@Entity
@Table(name = "demo_item")
public class DemoItemJpaEntity {

  @Id private UUID id;

  @Column(name = "tenant_id", nullable = false, length = 63)
  private String tenantId;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false, length = 500)
  private String description;

  @Column(nullable = false)
  private boolean active;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected DemoItemJpaEntity() {}

  private DemoItemJpaEntity(
      UUID id,
      String tenantId,
      String name,
      String description,
      boolean active,
      Instant createdAt,
      Instant updatedAt) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.description = description;
    this.active = active;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static DemoItemJpaEntity fromDomain(DemoItem item) {
    return new DemoItemJpaEntity(
        item.id(),
        item.tenantId().value(),
        item.name(),
        item.description(),
        item.active(),
        item.createdAt(),
        item.updatedAt());
  }

  public DemoItem toDomain() {
    return new DemoItem(
        id,
        TenantId.of(tenantId),
        name,
        description,
        active,
        createdAt,
        updatedAt);
  }
}
