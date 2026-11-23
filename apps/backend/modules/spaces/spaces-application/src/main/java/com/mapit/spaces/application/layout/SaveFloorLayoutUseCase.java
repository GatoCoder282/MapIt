package com.mapit.spaces.application.layout;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;

/**
 * Caso de uso: guardar el layout de una planta en una sola transacción
 * (HU-4.01, RN-7): lienzo + colocaciones de sectores.
 *
 * <p>Reglas: cada recurso se compara con su {@code updatedAt} observado
 * (conflicto → 409 lógico vía {@link LayoutConflictException}); cada colocación se
 * verifica contra el lienzo resultante (RN-10). Los elementos mantienen sus
 * coordenadas relativas cuando cambia la colocación o el tamaño del sector.
 */
@Service
public class SaveFloorLayoutUseCase {

  private final FloorRepository floors;
  private final SectorRepository sectors;
  private final SpaceElementRepository elements;
  private final TenantContext tenantContext;
  private final Clock clock;

  public SaveFloorLayoutUseCase(
      FloorRepository floors,
      SectorRepository sectors,
      SpaceElementRepository elements,
      TenantContext tenantContext,
      Clock clock) {
    this.floors = floors;
    this.sectors = sectors;
    this.elements = elements;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public Floor save(UUID floorId, SaveFloorLayoutCommand command) {
    TenantId tenantId = tenantContext.require();
    Instant now = clock.instant();

    Floor floor =
        floors
            .findAliveByIdForUpdate(tenantId, floorId)
            .orElseThrow(() -> new FloorNotFoundException(floorId));

    List<UUID> conflicts = new ArrayList<>();
    if (!floor.audit().updatedAt().equals(command.floorUpdatedAt())) {
      conflicts.add(floor.id());
    }

    Floor resized = floor.resizeCanvas(command.canvasWidth(), command.canvasHeight(), now, null);

    List<Sector> toSave = new ArrayList<>();
    var wantedIds = new HashSet<UUID>();
    for (var wanted : command.sectors().stream()
        .sorted(Comparator.comparing(SaveFloorLayoutCommand.SectorPlacement::id)).toList()) {
      if (!wantedIds.add(wanted.id())) {
        throw new IllegalArgumentException("Sector repetido en el guardado");
      }
      SectorId sectorId = SectorId.of(wanted.id());
      Sector current =
          sectors
              .findAliveByIdForUpdate(tenantId, sectorId)
              .filter(s -> s.floorId().equals(floorId))
              .orElse(null);
      if (current == null) {
        // Ajeno, dado de baja o de otro piso: conflicto, no 404 a medias (RN-7 todo o nada).
        conflicts.add(wanted.id());
        continue;
      }
      if (!current.audit().updatedAt().equals(wanted.updatedAt())) {
        conflicts.add(wanted.id());
        continue;
      }
      Placement placement = Placement.of(wanted.x(), wanted.y(), wanted.rotation());
      Sector updated = resize(current, wanted, now);
      if (!placement.fitsIn(updated.geometry(), resized.canvasWidth(), resized.canvasHeight())) {
        throw new LayoutOutOfBoundsException(
            "El sector " + wanted.id() + " no cabe en el lienzo en esa colocación");
      }
      toSave.add(updated.moveTo(placement, now, null));
    }

    if (!conflicts.isEmpty()) {
      throw new LayoutConflictException(conflicts);
    }

    // I-2: encoger el lienzo revalida también los sectores vivos omitidos del lote.
    for (Sector omitted : sectors.findAliveByFloorId(tenantId, floorId)) {
      if (wantedIds.contains(omitted.id().value())) continue;
      if (!omitted.placement().fitsIn(omitted.geometry(), resized.canvasWidth(), resized.canvasHeight())) {
        throw new LayoutOutOfBoundsException(
            "El sector " + omitted.id() + " quedaría fuera del lienzo al redimensionarlo");
      }
    }

    sectors.saveAll(toSave);
    return floors.save(resized);
  }

  private Sector resize(Sector current, SaveFloorLayoutCommand.SectorPlacement wanted, Instant now) {
    if (wanted.width() == null && wanted.height() == null) return current;
    if (wanted.width() == null || wanted.height() == null) {
      throw new IllegalArgumentException("El sector requiere ancho y alto");
    }
    Geometry size = Geometry.of(wanted.width(), wanted.height());
    if (size.equals(current.geometry())) return current;
    for (var element : elements.findAliveBySectorIdForUpdate(current.tenantId(), wanted.id())) {
      if (!Placement.of(element.x(), element.y(), element.rotation())
          .fitsIn(Geometry.of(element.width(), element.height()), size.width(), size.height())) {
        throw new LayoutOutOfBoundsException("El elemento " + element.id() + " no cabe en el sector");
      }
    }
    return current.resize(size, now, null);
  }
}
