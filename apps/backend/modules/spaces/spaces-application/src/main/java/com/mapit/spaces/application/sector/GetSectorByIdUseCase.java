package com.mapit.spaces.application.sector;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;

/** Caso de uso: obtener un sector por ID. */
@Service
public class GetSectorByIdUseCase {

  private final SectorRepository repository;
  private final TenantContext tenantContext;

  public GetSectorByIdUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public SectorResponse byId(UUID id) {
    TenantId tenantId = tenantContext.require();
    Sector sector =
        repository
            .findAliveById(tenantId, SectorId.of(id))
            .orElseThrow(() -> new SectorNotFoundException(id));
    return new SectorResponse(
        sector.id().value(),
        sector.name(),
        sector.slug().value(),
        sector.maxCapacity(),
        sector.audit().createdAt(),
        sector.audit().updatedAt());
  }
}
