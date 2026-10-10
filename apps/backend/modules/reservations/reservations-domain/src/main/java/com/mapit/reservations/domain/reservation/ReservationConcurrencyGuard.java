package com.mapit.reservations.domain.reservation;

import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Serializa la comprobación y creación de reservas que comparten elementos. */
public interface ReservationConcurrencyGuard {

  void lockResources(TenantId tenantId, Set<UUID> elementIds);
}
