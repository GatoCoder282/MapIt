package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;

@Service
public class DeleteSectorUseCase {

  private final SectorRepository repository;
  private final SpaceElementRepository elements;
  private final TenantContext tenantContext;

  public DeleteSectorUseCase(
      SectorRepository repository, SpaceElementRepository elements, TenantContext tenantContext) {
    this.repository = repository;
    this.elements = elements;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public void delete(UUID id) {
    TenantId tenantId = tenantContext.require();

    Sector sector =
        repository
            .findAliveByIdForUpdate(tenantId, SectorId.of(id))
            .orElseThrow(() -> new SectorNotFoundException(id));

    if (!elements.findAliveBySectorId(tenantId, id).isEmpty()) {
      throw new SectorHasActiveElementsException();
    }
    Sector deletedSector = sector.softDelete(Instant.now(), null);
    repository.save(deletedSector);
  }
}
