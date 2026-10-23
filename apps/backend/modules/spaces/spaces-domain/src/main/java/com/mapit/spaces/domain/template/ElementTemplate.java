package com.mapit.spaces.domain.template;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;

/**
 * Plantilla de configuración de un SpaceElement (CU-07 / HU-4.02 / MAP-202).
 *
 * <p>Una plantilla captura <em>solo</em> la parte de configuración reusable de un
 * SpaceElement: su {@code type} (qué clase de elemento es) y un {@code name} descriptivo.
 * No almacena {@code id} de instancia, {@code sectorId}, coordenadas ni estado operativo,
 * porque esos campos son datos de posición e instancia, no de configuración.
 *
 * <p>Justificación de campos:
 * <ul>
 *   <li>{@code type} — el único campo de configuración que no depende del sector ni de
 *       la operación. La vertical ya limita qué tipos son válidos; la plantilla no duplica
 *       esa regla: la valida el caso de uso al reutilizarla (igual que {@code CreateSpaceElementUseCase}).
 *   <li>{@code name} — identifica la plantilla para el usuario ("Mesa redonda 6 pax",
 *       "Barra VIP"); no es el nombre del elemento en el mapa.
 *   <li>{@code tenantId} — aislamiento multi-tenant obligatorio.
 *   <li>{@code audit} — mismo patrón que {@code SpaceElement} y {@code Sector}.
 * </ul>
 *
 * <p>Es un record inmutable: una vez creada, la configuración solo puede modificarse
 * devolviendo una copia actualizada (ver {@link #update}).
 */
public record ElementTemplate(
    ElementTemplateId id,
    TenantId tenantId,
    String name,
    SpaceElementType type,
    AuditTrail audit) {

  public ElementTemplate {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(name, "name no puede ser null");
    Objects.requireNonNull(type, "type no puede ser null");
    Objects.requireNonNull(audit, "audit no puede ser null");

    if (name.isBlank()) {
      throw new IllegalArgumentException("El nombre de la plantilla no puede estar vacío");
    }
    if (name.length() > 100) {
      throw new IllegalArgumentException(
          "El nombre de la plantilla no puede exceder 100 caracteres (recibidos: %d)"
              .formatted(name.length()));
    }
  }

  /**
   * Registra una nueva plantilla. El tenant sale del contexto de la petición, nunca del body.
   *
   * @param id       identificador generado por el caso de uso
   * @param tenantId tenant efectivo (del contexto)
   * @param name     nombre descriptivo de la plantilla
   * @param type     tipo de elemento (TABLE, BAR, etc.)
   * @param now      instante de creación
   * @param by       usuario que crea (nullable hasta CU-23/CU-24)
   */
  public static ElementTemplate register(
      ElementTemplateId id,
      TenantId tenantId,
      String name,
      SpaceElementType type,
      Instant now,
      UUID by) {
    return new ElementTemplate(id, tenantId, name, type, AuditTrail.created(now, by));
  }

  /**
   * Devuelve una copia con los campos editables actualizados: nombre y tipo.
   *
   * <p>No se puede actualizar una plantilla dada de baja.
   */
  public ElementTemplate update(String name, SpaceElementType type, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede actualizar una plantilla dada de baja");
    }
    return new ElementTemplate(id, tenantId, name, type, audit.touched(now, by));
  }

  /** Baja lógica de la plantilla. */
  public ElementTemplate softDelete(Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("La plantilla ya estaba dada de baja");
    }
    return new ElementTemplate(id, tenantId, name, type, audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
