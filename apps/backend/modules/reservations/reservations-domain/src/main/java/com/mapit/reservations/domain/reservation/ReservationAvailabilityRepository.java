package com.mapit.reservations.domain.reservation;

import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto de consulta de reservas vigentes que se superponen con un intervalo. */
public interface ReservationAvailabilityRepository {

  Set<UUID> findConflictingElementIds(
      TenantId tenantId, Set<UUID> elementIds, ReservationTimeRange timeRange);

  /**
   * True si el elemento tiene al menos una reserva en CREATED/CONFIRMED/ACTIVE
   * (HU-4.01: el borrado de elementos lo consulta desde spaces, RN-1).
   */
  default boolean existsActiveForSpaceElement(TenantId tenantId, UUID spaceElementId) {
    throw new UnsupportedOperationException("existsActiveForSpaceElement no implementado");
  }
}
