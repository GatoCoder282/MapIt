package com.mapit.spaces.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.SectorRepository;

/** Caso de uso: listar sectores de un piso. */
@Service
public class GetSectorsByFloorUseCase {

  private final SectorRepository repository;
  private final TenantContext tenantContext;

  public GetSectorsByFloorUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public List<SectorResponse> byFloor(UUID floorId) {
    TenantId tenantId = tenantContext.require();
    return repository
        .findAliveByFloorId(tenantId, floorId)
        .stream()
        .map(sector -> new SectorResponse(
            sector.id().value(),
            sector.name(),
            sector.slug().value(),
            sector.maxCapacity(),
            sector.audit().createdAt(),
            sector.audit().updatedAt()))
        .toList();
  }
}
