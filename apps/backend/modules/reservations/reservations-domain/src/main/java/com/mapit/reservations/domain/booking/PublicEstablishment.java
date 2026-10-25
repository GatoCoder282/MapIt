package com.mapit.reservations.domain.booking;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Establecimiento visible para el flujo público, resuelto por sus slugs. */
public record PublicEstablishment(TenantId tenantId, UUID id, String timezone) {

  public PublicEstablishment {
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(timezone, "timezone no puede ser null");
  }
}
