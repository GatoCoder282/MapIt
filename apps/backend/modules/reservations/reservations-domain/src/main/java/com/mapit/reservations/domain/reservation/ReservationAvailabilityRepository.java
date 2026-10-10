package com.mapit.reservations.domain.reservation;

import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto de consulta de reservas vigentes que se superponen con un intervalo. */
public interface ReservationAvailabilityRepository {

  Set<UUID> findConflictingElementIds(
      TenantId tenantId, Set<UUID> elementIds, ReservationTimeRange timeRange);
}
