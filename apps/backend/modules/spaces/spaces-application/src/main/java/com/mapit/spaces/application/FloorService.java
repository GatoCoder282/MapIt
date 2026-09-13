package com.mapit.spaces.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.Floor;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.application.EstablishmentNotFoundException;// Assuming this exists from CU-04

/**
 * Casos de uso de gestión de pisos (CU-05).
 *
 * <p>El tenantId sale siempre del TenantContext del servidor y nunca del
 * cuerpo de la petición (RN-2): si el cliente lo enviara, se ignora.
 */
@Service
public class FloorService {

  private static final int LEVEL_MAX = 999;
  private static final int SLUG_MAX_LENGTH = 64;

  private final FloorRepository floorRepository;
  private final EstablishmentRepository establishmentRepository;
  private final TenantContext tenantContext;
  private final java.time.Clock clock; // Using java.time.Clock for consistency

  public FloorService(
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository,
      TenantContext tenantContext,
      java.time.Clock clock) {
    this.floorRepository = floorRepository;
    this.establishmentRepository = establishmentRepository;
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
        currentAuthor()); // Assuming currentAuthor() returns UUID or null

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
      requireLevelFree(tenantId, actual.establishmentId(), resolvedLevel, id);
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

    // TODO: Verificar que no tiene sectores activos (cuando CU-05 parte 2 esté implementado)
    // if (sectorRepository.hasActiveSectorsByFloorId(tenantId, id)) {
    //   throw new FloorHasActiveSectorsException(id);
    // }

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
    // Generar slug del nombre
    String generated = generateSlugFromName(name);
    // Verificar que no colisione; si colisiona, añadir sufijo numérico
    String candidate = generated;
    int suffix = 1;
    // Use findAliveBySlug to check for existing slugs within the same establishment
    while (floorRepository.findAliveBySlug(tenantId, establishmentId, Slug.of(candidate)).isPresent()) {
      candidate = generated + "-" + suffix;
      // Ensure candidate length doesn't exceed max slug length after adding suffix
      if (candidate.length() > SLUG_MAX_LENGTH) {
        candidate = generated.substring(0, SLUG_MAX_LENGTH - String.valueOf(suffix).length() - 1) + "-" + suffix;
        if (candidate.length() > SLUG_MAX_LENGTH) {
            candidate = candidate.substring(0, SLUG_MAX_LENGTH); // Final truncation if necessary
        }
      }
      suffix++;
    }
    return Slug.of(candidate);
  }

  private String generateSlugFromName(String name) {
    String normalized = name
        .toLowerCase()
        .replaceAll("[áàäâ]", "a")
        .replaceAll("[éèëê]", "e")
        .replaceAll("[íìïî]", "i")
        .replaceAll("[óòöô]", "o")
        .replaceAll("[úùüû]", "u")
        .replaceAll("[ñ]", "n")
        .replaceAll("[^a-z0-9]+", "-") // Replace non-alphanumeric with hyphen
        .replaceAll("^-|-$", ""); // Remove leading/trailing hyphens

    // Ensure it starts with alphanumeric and has minimum length
    if (normalized.isEmpty()) {
      normalized = "floor";
    }
    if (normalized.length() < 2) {
      normalized = normalized + "-floor"; // Append to ensure minimum length if needed
    }
    // Truncate if it exceeds max length
    if (normalized.length() > SLUG_MAX_LENGTH) {
      normalized = normalized.substring(0, SLUG_MAX_LENGTH);
    }
    return normalized;
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
      UUID ownId) {
    // First, check if the level exists at all for this establishment among live floors.
    boolean levelExists = floorRepository.existsAliveByLevel(tenantId, establishmentId, level);

    if (levelExists) {
      // If the level exists, we need to verify if it belongs to the current entity being updated.
      // If ownId is null, it means we are creating a new floor, so any existing level is a conflict.
      if (ownId == null) {
        throw new FloorLevelAlreadyExistsException(level);
      } else {
        // If ownId is not null, we are updating an existing floor.
        // We need to retrieve the current floor to compare its level.
        Optional<Floor> existingFloorOpt = floorRepository.findAliveById(tenantId, ownId);
        if (existingFloorOpt.isPresent()) {
          Floor existingFloor = existingFloorOpt.get();
          // If the existing floor has a different level, then it's a conflict.
          // If it has the same level, it's not a conflict (no change).
          if (existingFloor.level() != level) {
            throw new FloorLevelAlreadyExistsException(level);
          }
          // If existingFloor.level() == level, it's not a conflict, so we do nothing.
        } else {
          // This case should ideally not happen if findAliveById worked correctly above,
          // but as a safeguard, if the entity to update isn't found, any existing level is a conflict.
          throw new FloorLevelAlreadyExistsException(level);
        }
      }
    }
    // If levelExists is false, no conflict.
  }


  private UUID currentAuthor() {
    // This is a placeholder. In a real application, this would fetch the current user's ID from security context.
    // For now, returning null as per instructions or previous context.
    return null;
  }
}
