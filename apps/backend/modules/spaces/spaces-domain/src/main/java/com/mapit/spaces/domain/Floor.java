package com.mapit.spaces.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Piso o nivel físico dentro de un establecimiento (CU-05).
 *
 * <p>Es un record inmutable sin setters: las reglas viven en el constructor
 * compacto, de modo que no se puede construir un piso inválido.
 * Modificarlo devuelve una instancia nueva.
 *
 * <p>El level es un entero entre 1 y 999 que indica la posición vertical:
 * valores bajos para sótanos (si se hubiera permitido), valores altos para
 * pisos superiores.
 */
public record Floor(
    UUID id,
    TenantId tenantId,
    UUID establishmentId,
    String name,
    int level,
    Slug slug,
    AuditTrail audit) {

  private static final int NAME_MAX_LENGTH = 100;
  private static final int LEVEL_MIN = 1;
  private static final int LEVEL_MAX = 999;

  public Floor {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(name, "name no puede ser null");
    Objects.requireNonNull(slug, "slug no puede ser null");
    Objects.requireNonNull(audit, "audit no puede ser null");

    name = name.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("name no puede estar vacío");
    }
    if (name.length() > NAME_MAX_LENGTH) {
      throw new IllegalArgumentException(
          "name debe tener entre 1 y %d caracteres".formatted(NAME_MAX_LENGTH));
    }
    if (level < LEVEL_MIN || level > LEVEL_MAX) {
      throw new IllegalArgumentException(
          "level debe estar entre %d y %d".formatted(LEVEL_MIN, LEVEL_MAX));
    }
  }

  /** Crea un piso nuevo. El id y las fechas las decide el llamador. */
  public static Floor register(
      UUID id,
      TenantId tenantId,
      UUID establishmentId,
      String name,
      int level,
      Slug slug,
      Instant now,
      UUID by) {
    return new Floor(
        id,
        tenantId,
        establishmentId,
        name,
        level,
        slug,
        AuditTrail.created(now, by));
  }

  /** Devuelve una copia con los datos editables actualizados. */
  public Floor update(String name, int level, Slug slug, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede actualizar un piso dado de baja");
    }
    return new Floor(
        id,
        tenantId,
        establishmentId,
        name,
        level,
        slug,
        audit.touched(now, by));
  }

  /**
   * Devuelve una copia marcada como dada de baja.
   *
   * <p>La baja es lógica: la fila se conserva porque sector apuntará a ella.
   * El slug se establece a null para liberarlo y permitir su reutilización.
   */
  public Floor softDelete(Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("El piso ya estaba dado de baja");
    }
    // Slug se pone a null para liberarlo
    return new Floor(
        id,
        tenantId,
        establishmentId,
        name,
        level,
        this.slug,  // Slug liberado
        audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
