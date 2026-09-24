package com.mapit.spaces.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.SpaceElementRepository;

/**
 * Consultas de elementos espaciales (HU-2.03 / MAP-114).
 *
 * <p>Miembro readonly del módulo: la lectura igual valida que el sector sea del tenant.
 * Igual que en CU-05, la lista debe mostrar solo elementos vivos del tenant del contexto;
 * la RLS es la segunda red y el filtro del adaptador la primera.
 */
@Service
@Transactional(readOnly = true)
public class SpaceElementQueryService {

  private final SpaceElementRepository repository;
  private final SpaceElementSupport support;
  private final TenantContext tenantContext;

  public SpaceElementQueryService(
      SpaceElementRepository repository,
      SectorRepository sectorRepository,
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository,
      TenantContext tenantContext) {
    this.repository = repository;
    this.support =
        new SpaceElementSupport(sectorRepository, floorRepository, establishmentRepository);
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
}
