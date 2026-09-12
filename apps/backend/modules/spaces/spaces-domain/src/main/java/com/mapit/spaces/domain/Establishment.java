package com.mapit.spaces.domain;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Establecimiento: el lugar físico que un tenant opera en MapIt (CU-04).
 *
 * <p>Es la primera entidad de negocio de la plataforma. Sobre ella colgarán los pisos y
 * sectores (CU-05) y los elementos del mapa (CU-06…CU-08).
 *
 * <p>Es un {@code record} inmutable y sin setters: las reglas viven en el constructor
 * compacto, de modo que <strong>no se puede construir un establecimiento inválido</strong>.
 * Modificarlo devuelve una instancia nueva.
 */
public record Establishment(
    UUID id,
    TenantId tenantId,
    String name,
    EstablishmentType type,
    Slug slug,
    String timezone,
    AuditTrail audit) {

  /** Zona horaria por defecto cuando el cliente no envía ninguna (RN-7). */
  public static final String ZONA_HORARIA_POR_DEFECTO = "America/La_Paz";

  private static final int LARGO_MAXIMO_NOMBRE = 120;

  public Establishment {
    Objects.requireNonNull(id, "El id no puede ser null");
    Objects.requireNonNull(tenantId, "El tenantId no puede ser null");
    Objects.requireNonNull(name, "El nombre no puede ser null");
    Objects.requireNonNull(type, "El tipo no puede ser null");
    Objects.requireNonNull(slug, "El slug no puede ser null");
    Objects.requireNonNull(timezone, "La zona horaria no puede ser null");
    Objects.requireNonNull(audit, "El rastro de auditoría no puede ser null");

    name = name.trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("El nombre no puede estar vacío");
    }
    if (name.length() > LARGO_MAXIMO_NOMBRE) {
      throw new IllegalArgumentException(
          "El nombre no puede superar los %d caracteres".formatted(LARGO_MAXIMO_NOMBRE));
    }
    if (!ZoneId.getAvailableZoneIds().contains(timezone)) {
      throw new IllegalArgumentException(
          "Zona horaria inválida: '%s'. Debe ser un identificador IANA.".formatted(timezone));
    }
  }

  /** Crea un establecimiento nuevo. El id y las fechas los decide el llamador, no el cliente. */
  public static Establishment register(
      UUID id,
      TenantId tenantId,
      String name,
      EstablishmentType type,
      Slug slug,
      String timezone,
      Instant now,
      UUID by) {
    return new Establishment(
        id,
        tenantId,
        name,
        type,
        slug,
        timezone == null || timezone.isBlank() ? ZONA_HORARIA_POR_DEFECTO : timezone,
        AuditTrail.created(now, by));
  }

  /**
   * Devuelve una copia con los datos editables actualizados.
   *
   * <p>El {@link EstablishmentType} <strong>no</strong> es parámetro: es inmutable tras la
   * creación (RN-3), porque cambiarlo invalidaría las plantillas de elemento de CU-07 y
   * los mapas ya dibujados. El contrato OpenAPI lo hace cumplir antes incluso de llegar
   * aquí, al no incluir {@code type} en {@code EstablishmentUpdateRequest}.
   */
  public Establishment update(String name, Slug slug, String timezone, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede actualizar un establecimiento dado de baja");
    }
    return new Establishment(
        id,
        tenantId,
        name,
        type,
        slug,
        timezone == null || timezone.isBlank() ? ZONA_HORARIA_POR_DEFECTO : timezone,
        audit.touched(now, by));
  }

  /**
   * Devuelve una copia marcada como dada de baja.
   *
   * <p>La baja es lógica (RN-5): la fila se conserva porque {@code floor} y {@code sector}
   * apuntarán a ella en CU-05, y un borrado físico dejaría huérfanos.
   */
  public Establishment softDelete(Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("El establecimiento ya estaba dado de baja");
    }
    return new Establishment(id, tenantId, name, type, slug, timezone, audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
