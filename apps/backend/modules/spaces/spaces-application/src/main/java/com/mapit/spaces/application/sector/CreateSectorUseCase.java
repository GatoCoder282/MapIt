package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Sector;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.Slug;

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
  private final TenantContext tenantContext;

  public CreateSectorUseCase(SectorRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional
  public SectorResponse create(CreateSectorCommand command) {
    TenantId tenantId = tenantContext.require();

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
    Sector saved = repository.save(sector);
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
    return new SectorResponse(
        sector.id().value(),
        sector.name(),
        sector.slug().value(),
        sector.maxCapacity(),
        sector.audit().createdAt(),
        sector.audit().updatedAt());
  }
}
