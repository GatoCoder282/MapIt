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

@Service
public class DeleteSectorUseCase {

  private final SectorRepository repository;
  private final TenantContext tenantContext;

  public DeleteSectorUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public void delete(UUID id) {
    TenantId tenantId = tenantContext.require();

    Sector sector =
        repository
            .findAliveById(tenantId, SectorId.of(id))
            .orElseThrow(() -> new SectorNotFoundException(id));

    Sector deletedSector = sector.softDelete(Instant.now(), null);
    repository.save(deletedSector);
  }
}
