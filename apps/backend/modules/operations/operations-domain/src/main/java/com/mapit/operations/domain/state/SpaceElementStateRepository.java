package com.mapit.operations.domain.state;

import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto de persistencia del estado operativo; no expone detalles de spaces ni JDBC. */
public interface SpaceElementStateRepository {

  Optional<OperationalSpaceElement> findAliveById(
      TenantId tenantId, UUID sectorId, UUID elementId);

  OperationalSpaceElement save(OperationalSpaceElement element);
}
