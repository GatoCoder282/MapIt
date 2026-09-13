package com.mapit.spaces.domain;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Value object que identifica de forma única un Sector dentro de un Tenant. */
public record SectorId(UUID value) {

  public SectorId {
    Objects.requireNonNull(value, " sectorId no puede ser null");
  }

  public static SectorId of(UUID value) {
    return new SectorId(value);
  }

  @Override
  public String toString() {
    return value.toString();
  }
}