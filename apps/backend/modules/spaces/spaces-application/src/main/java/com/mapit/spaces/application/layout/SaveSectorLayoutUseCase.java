package com.mapit.spaces.application.layout;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.application.spaceelement.SpaceElementHasActiveReservationsException;
import com.mapit.spaces.application.spaceelement.SpaceElementSupport;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.layout.SectorLayout;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorAppearance;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementReservationLookup;

/**
 * Caso de uso: guardar la distribución interna de un sector en una sola
 * transacción (HU-4.01, RN-7): dimensiones del sector + geometría de sus
 * elementos. Nunca toca {@code state} ni {@code type} (RN-9, edición por contexto).
 */
@Service
public class SaveSectorLayoutUseCase {

  private final SectorRepository sectors;
  private final SpaceElementRepository elements;
  private final SpaceElementSupport elementSupport;
  private final SpaceElementReservationLookup reservations;
  private final TenantContext tenantContext;
  private final Clock clock;

  public SaveSectorLayoutUseCase(
      SectorRepository sectors,
      SpaceElementRepository elements,
      SpaceElementSupport elementSupport,
      SpaceElementReservationLookup reservations,
      TenantContext tenantContext,
      Clock clock) {
    this.sectors = sectors;
    this.elements = elements;
    this.elementSupport = elementSupport;
    this.reservations = reservations;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public SectorLayout save(UUID sectorUuid, SaveSectorLayoutCommand command) {
    TenantId tenantId = tenantContext.require();
    Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
    var removedIds = new LinkedHashSet<UUID>();
    for (var deleted : command.deletedElements()) {
      if (!removedIds.add(deleted.id())) throw duplicate(deleted.id());
    }
    if (!removedIds.isEmpty()) reservations.lockResources(tenantId, removedIds);

    Sector sector =
        sectors
            .findAliveByIdForUpdate(tenantId, SectorId.of(sectorUuid))
            .orElseThrow(() -> new SectorNotFoundException(sectorUuid));

    Set<UUID> conflicts = new LinkedHashSet<>();
    if (!sector.audit().updatedAt().equals(command.sectorUpdatedAt())) {
      conflicts.add(sectorUuid);
    }

    var geometry = Geometry.of(command.width(), command.height());
    Map<UUID, SpaceElement> current = new HashMap<>();
    for (SpaceElement element : elements.findAliveBySectorIdForUpdate(tenantId, sectorUuid)) {
      current.put(element.id().value(), element);
    }
    command.elements().forEach(change -> checkVersion(current, conflicts, change.id(), change.updatedAt()));
    command.metadataUpdates().forEach(change -> checkVersion(current, conflicts, change.id(), change.updatedAt()));
    command.deletedElements().forEach(change -> checkVersion(current, conflicts, change.id(), change.updatedAt()));
    if (!conflicts.isEmpty()) throw new LayoutConflictException(List.copyOf(conflicts));

    Map<UUID, SpaceElement> changes = new HashMap<>();
    for (var wanted : command.elements()) {
      if (removedIds.contains(wanted.id()) || changes.containsKey(wanted.id())) throw duplicate(wanted.id());
      var element = current.get(wanted.id());
      changes.put(wanted.id(), element.update(
          element.type(), wanted.x(), wanted.y(), wanted.width(), wanted.height(), wanted.rotation(), now, null));
    }
    var metadataIds = new LinkedHashSet<UUID>();
    for (var metadata : command.metadataUpdates()) {
      if (removedIds.contains(metadata.id()) || !metadataIds.add(metadata.id())) throw duplicate(metadata.id());
      var element = changes.getOrDefault(metadata.id(), current.get(metadata.id()));
      changes.put(metadata.id(), element.update(
          element.type(), element.x(), element.y(), element.width(), element.height(), element.rotation(), now, null)
          .withMetadata(metadata.label(), metadata.capacity()));
    }

    for (var id : removedIds) {
      var element = current.remove(id);
      if (reservations.hasActiveReservations(tenantId, element.id())) {
        throw new SpaceElementHasActiveReservationsException(element.id());
      }
      changes.put(id, element.softDelete(now, null));
    }

    Map<UUID, SpaceElement> additions = new HashMap<>();
    if (!command.createdElements().isEmpty()) {
      var vertical = elementSupport.verticalDelSector(tenantId, sector.id());
      for (var creation : command.createdElements()) {
        var id = creation.id();
        if (additions.containsKey(id) || current.containsKey(id) || removedIds.contains(id)) {
          throw duplicate(id);
        }
        var type = elementSupport.parseType(creation.type());
        elementSupport.validarTipoPermitido(vertical, type);
        additions.put(id, SpaceElement.register(SpaceElementId.of(id), tenantId, sectorUuid, type,
            creation.x(), creation.y(), creation.width(), creation.height(),
            creation.rotation(), null, now, null).withMetadata(creation.label(), creation.capacity()));
      }
    }

    current.forEach((id, element) -> validateBounds(changes.getOrDefault(id, element), geometry));
    additions.values().forEach(element -> validateBounds(element, geometry));

    Set<UUID> liveIds = new LinkedHashSet<>(current.keySet());
    liveIds.addAll(additions.keySet());
    var appearance = SectorAppearance.forElements(
        command.appearance() == null ? sector.appearance() : command.appearance(), liveIds, removedIds);

    for (var element : additions.values()) {
      try {
        elements.insert(element);
      } catch (DataIntegrityViolationException exception) {
        throw new LayoutConflictException(List.of(element.id().value()));
      }
    }
    elements.saveAll(List.copyOf(changes.values()));
    sector = sectors.save(sector.resize(geometry, now, null).withAppearance(appearance));
    return new SectorLayout(sector, elements.findAliveBySectorId(tenantId, sectorUuid));
  }

  private static void checkVersion(
      Map<UUID, SpaceElement> current, Set<UUID> conflicts, UUID id, Instant updatedAt) {
    var element = current.get(id);
    if (element == null || !element.audit().updatedAt().equals(updatedAt)) conflicts.add(id);
  }

  private static void validateBounds(SpaceElement element, Geometry sector) {
    var placement = Placement.of(element.x(), element.y(), element.rotation());
    var size = Geometry.of(element.width(), element.height());
    if (!placement.fitsIn(size, sector.width(), sector.height())) {
      throw new LayoutOutOfBoundsException("El elemento " + element.id() + " no cabe en el sector");
    }
  }

  private static IllegalArgumentException duplicate(UUID id) {
    return new IllegalArgumentException("Operaciones incompatibles para el elemento " + id);
  }
}
