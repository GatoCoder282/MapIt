package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;

/** Caso de uso: actualizar un sector. */
@Service
public class UpdateSectorUseCase {

  private final SectorRepository repository;
  private final TenantContext tenantContext;

  public UpdateSectorUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public SectorResponse update(UpdateSectorCommand command) {
    TenantId tenantId = tenantContext.require();

    Sector sector =
        repository
            .findAliveById(tenantId, SectorId.of(command.id()))
            .orElseThrow(() -> new SectorNotFoundException(command.id()));

    // Igual que en create: slug vacío se autogenera a partir del nombre.
    Slug slug =
        command.slug() == null || command.slug().isBlank()
            ? Slug.fromName(command.name())
            : Slug.of(command.slug());

    requireSlugLibre(tenantId, sector, slug);

    // maxCapacity nulo conserva el actual: el formulario solo edita el nombre.
    Integer maxCapacity = command.maxCapacity() != null ? command.maxCapacity() : sector.maxCapacity();

    Instant now = Instant.now();
    sector = sector.update(command.name(), maxCapacity, slug, now, null);
    Sector saved = repository.save(sector);
    return toResponse(saved, now);
  }

  /** Verifica que el slug esté libre en el mismo piso y tenant, excluyendo el propio sector. */
  private void requireSlugLibre(TenantId tenantId, Sector sector, Slug slug) {
    Optional<Sector> duenio = repository.findAliveBySlug(tenantId, sector.floorId(), slug);
    if (duenio.isPresent() && !duenio.get().id().equals(sector.id())) {
      throw new SectorSlugAlreadyExistsException(slug.value());
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
