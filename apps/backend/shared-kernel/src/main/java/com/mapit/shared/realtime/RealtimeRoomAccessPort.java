package com.mapit.shared.realtime;

import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto transversal para autorizar la pertenencia de una identidad a una sala.
 *
 * <p>La política conoce solo identificadores y rol; el adaptador de {@code spaces} resuelve la
 * pertenencia en su propio modelo, evitando que bootstrap o operations importen otro bounded
 * context.
 */
public interface RealtimeRoomAccessPort {

  /** Devuelve si el usuario puede suscribirse al establecimiento o sector indicado. */
  boolean canSubscribe(
      TenantId tenantId,
      UUID userId,
      String role,
      UUID establishmentId,
      Optional<UUID> sectorId);
}
