package com.mapit.spaces.domain.sector;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;

/** Entidad de dominio que representa un sector dentro de un piso.
 *
 * <p>Es un record inmutable sin setters: las reglas de negocio viven en el
 * constructor compacto, de modo que no se puede construir un sector inválido.
 * Modificarlo devuelve una instancia nueva.
 *
 * <p>El nombre tiene como máximo 100 caracteres y el slug sigue el patrón
 * {@code ^[a-z0-9][a-z0-9-]{1,62}$}.
 *
 * <p><strong>HU-4.01:</strong> el sector tiene {@link Geometry} (dimensiones
 * intrínsecas, origen de las coordenadas de sus elementos) y {@link Placement}
 * (colocación dentro del lienzo de su planta). Son mundos separados (RN-2):
 * mover el sector en la planta jamás toca las coordenadas de sus elementos, y
 * editar un elemento jamás toca esta colocación. La pertenencia sigue 1:1
 * ({@code floorId} NOT NULL, RN-4); la reutilización entre plantas es copia
 * explícita (RN-5), nunca enlace vivo.
 */
public record Sector(
    SectorId id,
    TenantId tenantId,
    UUID floorId,
    String name,
    Integer maxCapacity,
    Slug slug,
    Geometry geometry,
    Placement placement,
    AuditTrail audit) {

  private static final int NAME_MAX_LENGTH = 100;
  private static final int MAX_CAPACITY_MAX = 9999;

  public Sector {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(floorId, "floorId no puede ser null");
    Objects.requireNonNull(name, "name no puede ser null");
    Objects.requireNonNull(slug, "slug no puede ser null");
    Objects.requireNonNull(geometry, "geometry no puede ser null");
    Objects.requireNonNull(placement, "placement no puede ser null");
    Objects.requireNonNull(audit, "audit no puede ser null");

    name = name.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("name no puede estar vacío");
    }
    if (name.length() > NAME_MAX_LENGTH) {
      throw new IllegalArgumentException(
          "name debe tener como máximo %d caracteres".formatted(NAME_MAX_LENGTH));
    }
    // null primero: `maxCapacity <= 0` desempaqueta un Integer y con null lanza
    // NullPointerException (500 no controlado) en vez de un 400 diagnosable.
    if (maxCapacity == null || maxCapacity <= 0) {
      throw new IllegalArgumentException("maxCapacity debe ser mayor a 0");
    }
  }

  /** Compatibilidad con el contrato anterior a HU-4.01: geometry/placement por defecto. */
  public Sector(
      SectorId id,
      TenantId tenantId,
      UUID floorId,
      String name,
      Integer maxCapacity,
      Slug slug,
      AuditTrail audit) {
    this(id, tenantId, floorId, name, maxCapacity, slug,
        Geometry.defaultSector(), Placement.origin(), audit);
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
        id, tenantId, floorId, name, maxCapacity, slug,
        geometry, placement, audit.touched(now, by));
  }

  /** Cambia la colocación dentro de la planta (vista de planta, RN-6). */
  public Sector moveTo(Placement newPlacement, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede colocar un sector dado de baja");
    }
    return new Sector(
        id, tenantId, floorId, name, maxCapacity, slug,
        geometry, newPlacement, audit.touched(now, by));
  }

  /** Cambia las dimensiones intrínsecas del sector (vista de sector, RN-6). */
  public Sector resize(Geometry newGeometry, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede redimensionar un sector dado de baja");
    }
    return new Sector(
        id, tenantId, floorId, name, maxCapacity, slug,
        newGeometry, placement, audit.touched(now, by));
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
        id, tenantId, floorId, name, maxCapacity, slug,
        geometry, placement, audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
