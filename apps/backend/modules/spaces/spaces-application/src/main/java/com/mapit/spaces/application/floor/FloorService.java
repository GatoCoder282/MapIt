package com.mapit.spaces.application.floor;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.establishment.EstablishmentNotFoundException;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.sector.SectorRepository;

/**
 * Casos de uso de gestión de pisos (CU-05).
 *
 * <p>El tenantId sale siempre del TenantContext del servidor y nunca del
 * cuerpo de la petición (RN-2): si el cliente lo enviara, se ignora.
 */
@Service
public class FloorService {

  private static final int LEVEL_MAX = 999;
  // Tope real del VO Slug: ^[a-z0-9][a-z0-9-]{1,62}$ = 63 caracteres máximo.
  private static final int SLUG_MAX_LENGTH = 63;

  private final FloorRepository floorRepository;
  private final EstablishmentRepository establishmentRepository;
  private final SectorRepository sectorRepository;
  private final TenantContext tenantContext;
  private final Clock clock;

  public FloorService(
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository,
      SectorRepository sectorRepository,
      TenantContext tenantContext,
      Clock clock) {
    this.floorRepository = floorRepository;
    this.establishmentRepository = establishmentRepository;
    this.sectorRepository = sectorRepository;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<Floor> findByEstablishment(UUID establishmentId) {
    TenantId tenantId = tenantContext.require();
    // Verificar que el establecimiento existe y pertenece al tenant
    establishmentRepository
        .findAliveById(tenantId, establishmentId)
        .orElseThrow(() -> new EstablishmentNotFoundException(establishmentId));
    return floorRepository.findAliveByEstablishmentId(tenantId, establishmentId);
  }

  @Transactional(readOnly = true)
  public Floor findById(UUID id) {
    return floorRepository
        .findAliveById(tenantContext.require(), id)
        .orElseThrow(() -> new FloorNotFoundException(id));
  }

  @Transactional
  public Floor create(
      UUID establishmentId,
      String name,
      Integer level,
      String slugValue) {
    TenantId tenantId = tenantContext.require();

    // Verificar que el establecimiento existe y pertenece al tenant
    establishmentRepository
        .findAliveById(tenantId, establishmentId)
        .orElseThrow(() -> new EstablishmentNotFoundException(establishmentId));

    // Resolver nivel: si no se especifica, usar el siguiente disponible
    int resolvedLevel = resolveLevel(tenantId, establishmentId, level);

    // Resolver slug: si no se especifica, generarlo del nombre
    Slug slug = resolveSlug(tenantId, establishmentId, slugValue, name);

    // Verificar unicidad del slug
    requireSlugFree(tenantId, establishmentId, slug, null);

    // Verificar unicidad del nivel
    requireLevelFree(tenantId, establishmentId, resolvedLevel, null);

    Instant now = clock.instant();
    Floor floor = Floor.register(
        UUID.randomUUID(),
        tenantId,
        establishmentId,
        name,
        resolvedLevel,
        slug,
        now,
        currentAuthor());

    return floorRepository.save(floor);
  }

  @Transactional
  public Floor update(UUID id, String name, Integer level, String slugValue) {
    TenantId tenantId = tenantContext.require();
    Floor actual = floorRepository
        .findAliveById(tenantId, id)
        .orElseThrow(() -> new FloorNotFoundException(id));

    // Resolver slug si se proporciona
    Slug resolvedSlug = slugValue != null && !slugValue.isBlank() ? Slug.of(slugValue) : actual.slug();

    // Resolver nivel si se proporciona
    int resolvedLevel = level != null ? level : actual.level();

    // Verificar unicidad del slug (si cambió)
    if (actual.slug() == null || !resolvedSlug.equals(actual.slug())) {
      requireSlugFree(tenantId, actual.establishmentId(), resolvedSlug, id);
    }

    // Verificar unicidad del nivel (si cambió)
    if (resolvedLevel != actual.level()) {
      requireLevelFree(tenantId, actual.establishmentId(), resolvedLevel, actual);
    }

    return floorRepository.save(
        actual.update(name, resolvedLevel, resolvedSlug, clock.instant(), currentAuthor()));
  }

  @Transactional
  public void softDelete(UUID id) {
    TenantId tenantId = tenantContext.require();
    Floor actual = floorRepository
        .findAliveById(tenantId, id)
        .orElseThrow(() -> new FloorNotFoundException(id));

    // RN: un piso con sectores vivos no se puede dar de baja — quedarían sectores
    // visibles colgando de un piso inexistente. La baja es en cascada manual:
    // primero los sectores, luego el piso.
    if (!sectorRepository.findAliveByFloorId(tenantId, id).isEmpty()) {
      throw new FloorHasActiveSectorsException(id);
    }

    floorRepository.save(actual.softDelete(clock.instant(), currentAuthor()));
  }

  private int resolveLevel(TenantId tenantId, UUID establishmentId, Integer level) {
    if (level != null) {
      return level;
    }
    // Asignar el siguiente nivel disponible
    Optional<Integer> maxLevel = floorRepository.findMaxLevel(tenantId, establishmentId);
    int nextLevel = maxLevel.map(l -> l + 1).orElse(1);
    if (nextLevel > LEVEL_MAX) {
      throw new IllegalStateException(
          "No se pueden crear más pisos: se alcanzó el nivel máximo (%d)".formatted(LEVEL_MAX));
    }
    return nextLevel;
  }

  private Slug resolveSlug(
      TenantId tenantId,
      UUID establishmentId,
      String slugValue,
      String name) {
    if (slugValue != null && !slugValue.isBlank()) {
      return Slug.of(slugValue);
    }
    // La normalización (tildes, ñ, unicode) vive en Slug.fromName; aquí solo se
    // resuelven colisiones añadiendo sufijo numérico, respetando el tope del VO.
    final String generated = derivarSlug(name);
    String candidate = generated;
    int suffix = 1;
    while (floorRepository.findAliveBySlug(tenantId, establishmentId, Slug.of(candidate)).isPresent()) {
      String suffixText = "-" + suffix;
      candidate = generated.substring(0, Math.min(generated.length(), SLUG_MAX_LENGTH - suffixText.length()))
          + suffixText;
      suffix++;
    }
    return Slug.of(candidate);
  }

  /**
   * Slug derivado del nombre. Si el nombre no produce ningún carácter válido
   * (p. ej. "!!!"), cae a un candidato neutro que el bucle de colisiones hará único.
   */
  private static String derivarSlug(String name) {
    try {
      return Slug.fromName(name).value();
    } catch (IllegalArgumentException sinDerivacion) {
      return "piso";
    }
  }

  private void requireSlugFree(
      TenantId tenantId,
      UUID establishmentId,
      Slug slug,
      UUID ownId) {
    floorRepository
        .findAliveBySlug(tenantId, establishmentId, slug)
        .ifPresent(existing -> {
          if (!existing.id().equals(ownId)) {
            throw new FloorSlugAlreadyExistsException(slug.value());
          }
        });
  }

  private void requireLevelFree(
      TenantId tenantId,
      UUID establishmentId,
      int level,
      Floor self) {
    // Un nivel ocupado por otro piso vivo es conflicto. `self` es el piso que se
    // está editando (null al crear): si el nivel ocupado es el suyo, no hay cambio.
    boolean ocupado = floorRepository.existsAliveByLevel(tenantId, establishmentId, level);
    if (ocupado && (self == null || self.level() != level)) {
      throw new FloorLevelAlreadyExistsException(level);
    }
  }

  /** Autor de la auditoría: null hasta CU-23/CU-24 (no hay usuario autenticado en dominio). */
  private UUID currentAuthor() {
    return null;
  }
}
