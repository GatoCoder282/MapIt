package com.mapit.spaces.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Elemento mínimo de demostración para validar un CRUD completo en MapIt. */
public record DemoItem(
    UUID id,
    TenantId tenantId,
    String name,
    String description,
    boolean active,
    Instant createdAt,
    Instant updatedAt) {

  public DemoItem {
    Objects.requireNonNull(id, "El id no puede ser null");
    Objects.requireNonNull(tenantId, "El tenantId no puede ser null");
    Objects.requireNonNull(name, "El nombre no puede ser null");
    Objects.requireNonNull(description, "La descripción no puede ser null");
    Objects.requireNonNull(createdAt, "createdAt no puede ser null");
    Objects.requireNonNull(updatedAt, "updatedAt no puede ser null");

    name = name.trim();
    description = description.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("El nombre no puede estar vacío");
    }
    if (name.length() > 120) {
      throw new IllegalArgumentException("El nombre no puede superar los 120 caracteres");
    }
    if (description.length() > 500) {
      throw new IllegalArgumentException("La descripción no puede superar los 500 caracteres");
    }
  }

  /** Devuelve una copia con los datos editables actualizados. */
  public DemoItem update(String name, String description, boolean active, Instant updatedAt) {
    return new DemoItem(id, tenantId, name, description, active, createdAt, updatedAt);
  }
}
