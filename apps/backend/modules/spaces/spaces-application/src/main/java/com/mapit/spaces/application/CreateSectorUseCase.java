package com.mapit.spaces.application;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Sector;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.Slug;

/** Caso de uso: crear un sector en un piso específico. */
@Service
public class CreateSectorUseCase {

  private final SectorRepository repository;
  private final TenantContext tenantContext;

  public CreateSectorUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public SectorResponse create(CreateSectorCommand command) {
    TenantId tenantId = tenantContext.require();

    requireSlugLibre(tenantId, command.floorId(), command.slug());

    Instant now = Instant.now();
    Sector sector =
        Sector.register(
            SectorId.of(UUID.randomUUID()),
            tenantId,
            command.floorId(),
            command.name(),
            command.maxCapacity(),
            Slug.of(command.slug()),
            now,
            null);
    Sector saved = repository.save(sector);
    return toResponse(saved, now);
  }

  /** Verifica que el slug no esté usado por otro sector vivo del mismo tenant y piso. */
  private void requireSlugLibre(TenantId tenantId, UUID floorId, String slugValue) {
    Optional<Sector> duenio =
        repository.findAliveBySlug(tenantId, floorId, Slug.of(slugValue));
    if (duenio.isPresent()) {
      throw new SectorSlugAlreadyExistsException(slugValue);
    }
  }

  private SectorResponse toResponse(Sector sector, Instant now) {
    return new SectorResponse(
        sector.id().value(),
        sector.name(),
        sector.slug().value(),
        sector.maxCapacity(),
        sector.audit().createdAt(),
        sector.audit().updatedAt());
  }
}
