package com.mapit.spaces.application.layout;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;

/**
 * Caso de uso: guardar la distribución interna de un sector en una sola
 * transacción (HU-4.01, RN-7): dimensiones del sector + geometría de sus
 * elementos. Nunca toca {@code state} ni {@code type} (RN-9, edición por contexto).
 */
@Service
public class SaveSectorLayoutUseCase {

  private final SectorRepository sectors;
  private final SpaceElementRepository elements;
  private final TenantContext tenantContext;
  private final Clock clock;

  public SaveSectorLayoutUseCase(
      SectorRepository sectors,
      SpaceElementRepository elements,
      TenantContext tenantContext,
      Clock clock) {
    this.sectors = sectors;
    this.elements = elements;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public Sector save(UUID sectorUuid, SaveSectorLayoutCommand command) {
    TenantId tenantId = tenantContext.require();
    Instant now = clock.instant();

    Sector sector =
        sectors
            .findAliveById(tenantId, SectorId.of(sectorUuid))
            .orElseThrow(() -> new SectorNotFoundException(sectorUuid));

    List<UUID> conflicts = new ArrayList<>();
    if (!sector.audit().updatedAt().equals(command.sectorUpdatedAt())) {
      conflicts.add(sectorUuid);
    }

    Geometry newGeometry = Geometry.of(command.width(), command.height());

    List<SpaceElement> toSave = new ArrayList<>();
    for (SaveSectorLayoutCommand.ElementGeometry wanted : command.elements()) {
      SpaceElement current =
          elements.findAliveById(tenantId, sectorUuid, SpaceElementId.of(wanted.id())).orElse(null);
      if (current == null) {
        conflicts.add(wanted.id());
        continue;
      }
      if (!current.audit().updatedAt().equals(wanted.updatedAt())) {
        conflicts.add(wanted.id());
        continue;
      }
      Geometry elementGeometry = Geometry.of(wanted.width(), wanted.height());
      Placement inSector = Placement.of(wanted.x(), wanted.y(), wanted.rotation());
      if (!inSector.fitsIn(elementGeometry, newGeometry.width(), newGeometry.height())) {
        throw new LayoutOutOfBoundsException(
            "El elemento " + wanted.id() + " no cabe en el sector con esas coordenadas");
      }
      toSave.add(
          current.update(
              current.type(), wanted.x(), wanted.y(), wanted.width(), wanted.height(),
              wanted.rotation(), now, null));
    }

    if (!conflicts.isEmpty()) {
      throw new LayoutConflictException(conflicts);
    }

    // CA-7 / I-1: encoger el sector debe revalidar también los elementos vivos que el
    // cliente omitió del lote — no pueden quedar fuera en silencio.
    var wantedIds = toSave.stream().map(e -> e.id().value()).collect(java.util.stream.Collectors.toSet());
    for (SpaceElement outside : elements.findAliveBySectorId(tenantId, sectorUuid)) {
      if (wantedIds.contains(outside.id().value())) continue;
      Placement pos = Placement.of(outside.x(), outside.y(), outside.rotation());
      Geometry size = Geometry.of(outside.width(), outside.height());
      if (!pos.fitsIn(size, newGeometry.width(), newGeometry.height())) {
        throw new LayoutOutOfBoundsException(
            "El elemento " + outside.id() + " quedaría fuera del sector al redimensionarlo");
      }
    }

    elements.saveAll(toSave);
    return sectors.save(sector.resize(newGeometry, now, null));
  }
}
