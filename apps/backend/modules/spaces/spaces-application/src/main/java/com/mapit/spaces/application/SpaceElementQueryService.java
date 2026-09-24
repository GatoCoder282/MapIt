package com.mapit.spaces.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SpaceElementId;
import com.mapit.spaces.domain.SpaceElementRepository;

/**
 * Consultas de elementos espaciales (HU-2.03 / MAP-114).
 *
 * <p>La lectura igual valida que el sector sea del tenant (la vertical no se usa en la
 * lista: la consulta no la expone). La RLS es la segunda red y el filtro del adaptador la
 * primera.
 */
@Service
@Transactional(readOnly = true)
public class SpaceElementQueryService {

  private final SpaceElementRepository repository;
  private final TenantContext tenantContext;
  private final SpaceElementSupport support;

  public SpaceElementQueryService(
      SpaceElementRepository repository,
      SpaceElementSupport support,
      TenantContext tenantContext) {
    this.repository = repository;
    this.support = support;
    this.tenantContext = tenantContext;
  }

  /** Elementos vivos de un sector del tenant actual. El sector debe existir para el tenant. */
  public List<SpaceElementResponse> bySector(UUID sectorId) {
    TenantId tenantId = tenantContext.require();
    support.verticalDelSector(tenantId, new SectorId(sectorId));
    return repository.findAliveBySectorId(tenantId, sectorId).stream()
        .map(CreateSpaceElementUseCase::toResponse)
        .toList();
  }

  /** Detalle de un elemento vivo del sector, scoped al tenant. */
  public SpaceElementResponse byId(UUID sectorId, UUID elementId) {
    TenantId tenantId = tenantContext.require();
    support.verticalDelSector(tenantId, new SectorId(sectorId));
    return repository
        .findAliveById(tenantId, sectorId, new SpaceElementId(elementId))
        .map(CreateSpaceElementUseCase::toResponse)
        .orElseThrow(() -> new SpaceElementNotFoundException(elementId));
  }
}
