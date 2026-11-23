package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;

/** Caso de uso: crear un sector en un piso específico. */
@Service
public class CreateSectorUseCase {

  /**
   * Capacidad por defecto cuando el cliente no la envía.
   *
   * <p>El contrato {@code SectorCreateRequest} solo pide {@code name} y {@code slug};
   * la BD exige {@code max_capacity NOT NULL CHECK (> 0)}. El default vive aquí (capa
   * de aplicación), no en el dominio: es una decisión del contrato, no del negocio.
   */
  private static final int DEFAULT_MAX_CAPACITY = 1;

  private final SectorRepository repository;
  private final FloorRepository floors;
  private final TenantContext tenantContext;

  public CreateSectorUseCase(
      SectorRepository repository, FloorRepository floors, TenantContext tenantContext) {
    this.repository = repository;
    this.floors = floors;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public SectorResponse create(CreateSectorCommand command) {
    TenantId tenantId = tenantContext.require();
    var floor = floors.findAliveByIdForUpdate(tenantId, command.floorId())
        .orElseThrow(() -> new FloorNotFoundException(command.floorId()));

    // El contrato dice que el slug se autogenera en el servidor: el cliente manda "".
    Slug slug =
        command.slug() == null || command.slug().isBlank()
            ? Slug.fromName(command.name())
            : Slug.of(command.slug());

    int maxCapacity =
        command.maxCapacity() == null ? DEFAULT_MAX_CAPACITY : command.maxCapacity();

    requireSlugLibre(tenantId, command.floorId(), slug);

    Instant now = Instant.now();
    Sector sector =
        Sector.register(
            SectorId.of(UUID.randomUUID()),
            tenantId,
            command.floorId(),
            command.name(),
            maxCapacity,
            slug,
            now,
            null);
    var size = Geometry.of(
        Math.min(sector.geometry().width(), floor.canvasWidth()),
        Math.min(sector.geometry().height(), floor.canvasHeight()));
    Sector saved = repository.save(sector.resize(size, now, null));
    return toResponse(saved, now);
  }

  /** Verifica que el slug no esté usado por otro sector vivo del mismo tenant y piso. */
  private void requireSlugLibre(TenantId tenantId, UUID floorId, Slug slug) {
    Optional<Sector> duenio = repository.findAliveBySlug(tenantId, floorId, slug);
    if (duenio.isPresent()) {
      throw new SectorSlugAlreadyExistsException(slug.value());
    }
  }

  private SectorResponse toResponse(Sector sector, Instant now) {
    return SectorResponse.fromDomain(sector);
  }
}
