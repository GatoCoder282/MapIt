package com.mapit.reservations.domain.reservation;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto para validar establecimiento y recursos sin importar el módulo spaces. */
public interface ReservationResourceRepository {

  boolean establishmentExists(TenantId tenantId, UUID establishmentId);

  List<ReservationResource> findAliveByIds(TenantId tenantId, Collection<UUID> elementIds);
}
