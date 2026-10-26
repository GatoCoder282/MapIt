package com.mapit.operations.domain.state;

import java.util.List;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto para registrar y consultar la trazabilidad de estados. */
public interface SpaceElementStateChangeRepository {
  List<SpaceElementStateChange> findByElement(
      TenantId tenantId, UUID sectorId, UUID elementId);

  /** Cambios vivos registrados para el elemento; base de la versión del agregado. */
  long countByElement(TenantId tenantId, UUID sectorId, UUID elementId);
}
