package com.mapit.operations.domain.state;

import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto que resuelve lo que el evento de tiempo real necesita y el elemento operativo no guarda
 * (HU-3.02 / MAP-146): el establecimiento dueño del sector y la versión del agregado.
 */
public interface SpaceElementRealtimeContextRepository {

  /**
   * Se consulta después de auditar el cambio, dentro de la misma transacción.
   *
   * <p>La versión es el número de cambios auditados del elemento: la bitácora es append-only y el
   * {@code UPDATE} previo bloquea la fila hasta el commit, así que crece por elemento.
   */
  SpaceElementRealtimeContext resolve(TenantId tenantId, UUID sectorId, UUID elementId);

  /** Establecimiento del sector y versión del elemento tras el último cambio. */
  record SpaceElementRealtimeContext(UUID establishmentId, long aggregateVersion) {}
}
