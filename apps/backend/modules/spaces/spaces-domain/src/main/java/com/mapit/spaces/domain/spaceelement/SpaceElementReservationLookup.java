package com.mapit.spaces.domain.spaceelement;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de consulta de reservas activas sobre un elemento (HU-4.01).
 *
 * <p>El módulo {@code spaces} no puede importar {@code reservations} (los módulos no se
 * importan entre sí): este puerto expresa lo que necesita el borrado de elementos
 * (RN-1: la identidad de una mesa con reservas es inviolable) y lo implementa un
 * adaptador cableado por {@code bootstrap}.
 */
public interface SpaceElementReservationLookup {

  /** True si el elemento tiene al menos una reserva en estado activo. */
  boolean hasActiveReservations(TenantId tenantId, SpaceElementId elementId);
}
