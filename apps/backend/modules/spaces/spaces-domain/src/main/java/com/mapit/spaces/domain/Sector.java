package com.mapit.spaces.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Entidad de dominio que representa un sector dentro de un piso.
 *
 * <p>Es un record inmutable sin setters: las reglas de negocio viven en el
 * constructor compacto, de modo que no se puede construir un sector inválido.
 * Modificarlo devuelve una instancia nueva.
 *
 * <p>El nombre tiene como máximo 100 caracteres y el slug sigue el patrón
 * {@code ^[a-z0-9][a-z0-9-]{1,62}$}.
 */
public record Sector(
    SectorId id,
    TenantId tenantId,
    UUID floorId,
    String name,
    Integer maxCapacity,
    Slug slug,
    AuditTrail audit) {

  private static final int NAME_MAX_LENGTH = 100;
  private static final int MAX_CAPACITY_MAX = 9999;

  public Sector {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(floorId, "floorId no puede ser null");
    Objects.requireNonNull(name, "name no puede ser null");
    Objects.requireNonNull(slug, "slug no puede ser null");
    Objects.requireNonNull(audit, "audit no puede ser null");

    name = name.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("name no puede estar vacío");
    }
    if (name.length() > NAME_MAX_LENGTH) {
      throw new IllegalArgumentException(
          "name debe tener como máximo %d caracteres".formatted(NAME_MAX_LENGTH));
    }
    if (maxCapacity <= 0) {
      throw new IllegalArgumentException("maxCapacity debe ser mayor a 0");
    }
  }

  /** Crea un sector nuevo.
   *
   * @param id          identificador único del sector
   * @param tenantId    identificador del inquilino (multi-tenant)
   * @param floorId     identificador del piso al que pertenece
   * @param name        nombre del sector (1-100 chars)
   * @param slug        identificador corto y url-friendly
   * @param maxCapacity capacidad máxima del sector (> 0)
   * @param now         instante actual de creación
   * @param by          usuario que crea el sector
   */
  public static Sector register(
      SectorId id,
      TenantId tenantId,
      UUID floorId,
      String name,
      Integer maxCapacity,
      Slug slug,
      Instant now,
      UUID by) {
    return new Sector(
        id,
        tenantId,
        floorId,
        name,
        maxCapacity,
        slug,
        AuditTrail.created(now, by));
  }

  /** Devuelve una copia con los datos editables actualizados. */
  public Sector update(String name, Integer maxCapacity, Slug slug, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede actualizar un sector dado de baja");
    }
    return new Sector(
        id,
        tenantId,
        floorId,
        name,
        maxCapacity,
        slug,
        audit.touched(now, by));
  }

  /**
   * Devuelve una copia marcada como dada de baja.
   *
   * <p>La baja es lógica: la fila se conserva porque pisos/elementos apuntarán a ella.
   */
  public Sector softDelete(Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("El sector ya estaba dado de baja");
    }
    return new Sector(
        id,
        tenantId,
        floorId,
        name,
        maxCapacity,
        slug,
        audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
