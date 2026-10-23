package com.mapit.spaces.domain.layout;

import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de lectura agregada del layout de una planta (HU-4.01, RN-3).
 *
 * <p>Una sola consulta trae piso + sectores colocados + elementos vivos de cada
 * sector, evitando el fan-out N+1 del cliente (piso → sectores → elementos).
 */
public interface LayoutQueryRepository {

  /** Layout de un piso vivo del tenant. Vacío si no existe o es de otro tenant. */
  Optional<FloorLayout> findFloorLayout(TenantId tenantId, UUID floorId);
}
