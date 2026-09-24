package com.mapit.spaces.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/**
 * Elemento espacial: la unidad mínima del mapa de un sector (HU-2.03 / CU-08).
 *
 * <p>Representa una mesa, barra, butaca, habitación, etc. anclada a un sector con
 * coordenadas {@code x}/{@code y} relativas a ese sector (el origen es la esquina superior
 * izquierda del sector, como en el editor de mapas del frontend).
 *
 * <p>Es un record inmutable y sin setters: las reglas viven en el constructor compacto,
 * de modo que <strong>no se puede construir un elemento inválido</strong>. Modificarlo
 * devuelve una instancia nueva, como en {@link Sector}.
 *
 * <p><strong>Incertidumbre documentada (RN-6 de la spec):</strong> el modelo de sector no
 * tiene dimensiones todavía, así que aquí no se puede validar un límite superior de
 * coordenadas contra el sector. Cuando exista, la regla se añade al constructor sin cambiar
 * el contrato de la API.
 *
 * <p>El {@code state} nace del {@code initialState} del alta pero es un dato mutable de
 * cara a HU-3.01 (transiciones auditadas): el modelo no congela el estado ni impide
 * cambiarlo después; solo lo protege de cambios informales en esta entrega.
 */
public record SpaceElement(
    SpaceElementId id,
    TenantId tenantId,
    UUID sectorId,
    SpaceElementType type,
    double x,
    double y,
    SpaceElementState state,
    AuditTrail audit) {

  public SpaceElement {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(sectorId, "sectorId no puede ser null");
    Objects.requireNonNull(type, "type no puede ser null");
    Objects.requireNonNull(state, "state no puede ser null");
    Objects.requireNonNull(audit, "audit no puede ser null");

    if (!Double.isFinite(x) || !Double.isFinite(y)) {
      throw new IllegalArgumentException("x e y deben ser números finitos");
    }
    if (x < 0 || y < 0) {
      throw new IllegalArgumentException(
          "x e y son relativas al sector y no pueden ser negativas (recibidas x=%s, y=%s)"
              .formatted(x, y));
    }
  }

  /**
   * Registra un elemento nuevo en un sector. El tenant lo fija el backend desde el
   * contexto de la petición, nunca el cliente.
   *
   * @param id            identificador del elemento
   * @param tenantId      tenant efectivo (del contexto)
   * @param sectorId      sector al que pertenece, ya verificado contra el tenant
   * @param type          tipo del elemento, ya verificado contra la vertical
   * @param x             coordenada horizontal relativa al sector
   * @param y             coordenada vertical relativa al sector
   * @param initialState  estado inicial; si es {@code null}, usa {@link SpaceElementState#AVAILABLE}
   * @param now           instante de creación
   * @param by            usuario que crea (nullable hasta CU-23/CU-24)
   */
  public static SpaceElement register(
      SpaceElementId id,
      TenantId tenantId,
      UUID sectorId,
      SpaceElementType type,
      Double x,
      Double y,
      SpaceElementState initialState,
      Instant now,
      UUID by) {
    // IllegalArgumentException (no NullPointerException): un body JSON sin x/y debe dar
    // 400 controlado con Problem Details, no un 500 con stacktrace.
    if (x == null || y == null) {
      throw new IllegalArgumentException("x e y son obligatorias");
    }
    return new SpaceElement(
        id,
        tenantId,
        sectorId,
        type,
        x,
        y,
        initialState == null ? SpaceElementState.AVAILABLE : initialState,
        AuditTrail.created(now, by));
  }

  /**
   * Devuelve una copia con los campos editables actualizados: tipo y coordenadas.
   *
   * <p>El estado <strong>no</strong> es editable aquí a propósito: las transiciones de
   * estado auditadas son HU-3.01. La baja será un paso aparte (CU-14 / operaciones),
   * igual que en Sector/Floor.
   */
  public SpaceElement update(
      SpaceElementType type, Double x, Double y, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede actualizar un elemento dado de baja");
    }
    if (x == null || y == null) {
      throw new IllegalArgumentException("x e y son obligatorias");
    }
    return new SpaceElement(
        id, tenantId, sectorId, type, x, y, state, audit.touched(now, by));
  }

  /**
   * Devuelve una copia con el estado cambiado. Reservado para HU-3.01 (transiciones
   * auditadas vía outbox); aquí solo existe para que el dominio reste extensible sin
   * romper el contrato del record.
   */
  public SpaceElement changeState(SpaceElementState newState, Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("No se puede cambiar el estado de un elemento dado de baja");
    }
    return new SpaceElement(
        id, tenantId, sectorId, type, x, y, newState, audit.touched(now, by));
  }

  /**
   * Marca el elemento como dado de baja (lógica, por si reservas/bitácora futuras lo
   * referencian) — igual que en {@code Sector}.
   */
  public SpaceElement softDelete(Instant now, UUID by) {
    if (audit.isDeleted()) {
      throw new IllegalStateException("El elemento ya estaba dado de baja");
    }
    return new SpaceElement(
        id, tenantId, sectorId, type, x, y, state, audit.deleted(now, by));
  }

  public boolean isDeleted() {
    return audit.isDeleted();
  }
}
