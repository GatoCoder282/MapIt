package com.mapit.platform.domain;

import java.time.Instant;
import java.util.Objects;

import com.mapit.shared.tenant.TenantId;

/** Empresa registrada en la plataforma y raíz del aislamiento multi-tenant. */
public record Tenant(
    TenantId id,
    String name,
    String slug,
    BusinessVertical vertical,
    TenantStatus status,
    Instant createdAt,
    Instant updatedAt) {

  private static final int MAX_NAME_LENGTH = 120;

  public Tenant {
    Objects.requireNonNull(id, "El id no puede ser null");
    Objects.requireNonNull(name, "El nombre no puede ser null");
    Objects.requireNonNull(slug, "El slug no puede ser null");
    Objects.requireNonNull(vertical, "La vertical no puede ser null");
    Objects.requireNonNull(status, "El estado no puede ser null");
    Objects.requireNonNull(createdAt, "createdAt no puede ser null");
    Objects.requireNonNull(updatedAt, "updatedAt no puede ser null");

    name = name.trim();
    slug = slug.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("El nombre no puede estar vacío");
    }
    if (name.length() > MAX_NAME_LENGTH) {
      throw new IllegalArgumentException("El nombre no puede superar los 120 caracteres");
    }
    if (!slug.matches("^[a-z0-9][a-z0-9-]{1,62}$")) {
      throw new IllegalArgumentException(
          "El slug debe usar minúsculas, dígitos y guiones, entre 2 y 63 caracteres");
    }
  }

  /** Crea un tenant nuevo en estado activo. */
  public static Tenant register(
      TenantId id, String name, String slug, BusinessVertical vertical, Instant now) {
    return new Tenant(id, name, slug, vertical, TenantStatus.ACTIVE, now, now);
  }
}
