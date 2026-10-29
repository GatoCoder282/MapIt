package com.mapit.spaces.application.layout;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.application.spaceelement.InvalidElementTypeForVerticalException;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.layout.SectorLayout;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.domain.spaceelement.SpaceElementTypePolicy;

/**
 * Caso de uso: duplicar un sector hacia otra planta del mismo tenant (HU-4.01, RN-5).
 *
 * <p>Copia explícita: sector nuevo (identidad nueva) + clones de sus elementos vivos
 * con UUIDs nuevos. Reglas:
 * <ul>
 *   <li>El origen y la planta destino deben ser vivos y del tenant; ajeno → 404.</li>
 *   <li>Los clones nacen {@code AVAILABLE}: son recursos físicos nuevos, sin reservas.</li>
 *   <li>Se re-valida la política de tipos contra la vertical del establecimiento de la
 *       planta destino (duplicar entre verticales incompatibles falla con 400).</li>
 *   <li>El nombre deriva como {@code "<origen> (copia)"} y el slug se ajusta hasta ser
 *       único en la planta destino si se omiten.</li>
 *   <li>La copia nace sin colocación en el lienzo ({@link Placement#origin()}); la vista de
 *       planta la posiciona con {@code saveFloorLayout} después.</li>
 * </ul>
 */
@Service
public class DuplicateSectorUseCase {

  private static final String COPIA = " (copia)";

  private final SectorRepository sectors;
  private final SpaceElementRepository elements;
  private final FloorRepository floors;
  private final EstablishmentRepository establishments;
  private final TenantContext tenantContext;
  private final Clock clock;

  public DuplicateSectorUseCase(
      SectorRepository sectors,
      SpaceElementRepository elements,
      FloorRepository floors,
      EstablishmentRepository establishments,
      TenantContext tenantContext,
      Clock clock) {
    this.sectors = sectors;
    this.elements = elements;
    this.floors = floors;
    this.establishments = establishments;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public SectorLayout duplicate(UUID floorId, DuplicateSectorCommand command) {
    TenantId tenantId = tenantContext.require();
    Instant now = clock.instant();

    Floor targetFloor =
        floors
            .findAliveById(tenantId, floorId)
            .orElseThrow(() -> new FloorNotFoundException(floorId));

    Sector source =
        sectors
            .findAliveById(tenantId, SectorId.of(command.sourceSectorId()))
            .orElseThrow(() -> new SectorNotFoundException(command.sourceSectorId()));

    // La biblioteca es del establecimiento: duplicar entre plantas, no entre sedes (M-8).
    Floor sourceFloor =
        floors
            .findAliveById(tenantId, source.floorId())
            .orElseThrow(() -> new SectorNotFoundException(command.sourceSectorId()));
    if (!sourceFloor.establishmentId().equals(targetFloor.establishmentId())) {
      throw new IllegalArgumentException(
          "Solo se pueden duplicar sectores dentro del mismo establecimiento");
    }

    EstablishmentType vertical = verticalDelEstablecimiento(tenantId, targetFloor);

    String name = deriveName(command.name(), source.name());
    Slug slug = uniqueSlug(tenantId, floorId, command.slug(), name);

    Sector copy = sectors.save(new Sector(
        SectorId.of(UUID.randomUUID()),
        tenantId,
        floorId,
        name,
        source.maxCapacity(),
        slug,
        source.geometry(),
        Placement.origin(),
        com.mapit.spaces.domain.AuditTrail.created(now, null)));

    List<SpaceElement> clones = elements.findAliveBySectorId(tenantId, source.id().value())
        .stream()
        .peek(el -> requireTipoPermitido(vertical, el.type()))
        .map(el -> SpaceElement.register(
            SpaceElementId.generate(),
            tenantId,
            copy.id().value(),
            el.type(),
            el.x(), el.y(), el.width(), el.height(), el.rotation(),
            SpaceElementState.AVAILABLE,
            now,
            null).withMetadata(el.label(), el.capacity()))
        .map(elements::save)
        .toList();

    return new SectorLayout(copy, clones);
  }

  private EstablishmentType verticalDelEstablecimiento(TenantId tenantId, Floor floor) {
    return establishments
        .findAliveById(tenantId, floor.establishmentId())
        .orElseThrow(() -> new IllegalStateException(
            "Piso " + floor.id() + " apunta a un establecimiento inexistente"))
        .type();
  }

  private void requireTipoPermitido(EstablishmentType vertical, SpaceElementType type) {
    if (!SpaceElementTypePolicy.esPermitido(vertical, type)) {
      throw new InvalidElementTypeForVerticalException(vertical, type);
    }
  }

  private String deriveName(String requested, String sourceName) {
    if (requested != null && !requested.isBlank()) {
      return requested;
    }
    String base = sourceName + COPIA;
    return base.length() <= 100 ? base : base.substring(0, 100);
  }

  /** Slug único en la planta destino: el pedido, el derivado del nombre, o sufijos -N. */
  private Slug uniqueSlug(TenantId tenantId, UUID floorId, String requested, String name) {
    Slug base = requested != null && !requested.isBlank()
        ? Slug.of(requested)
        : Slug.fromName(name);
    if (sectors.findAliveBySlug(tenantId, floorId, base).isEmpty()) {
      return base;
    }
    for (int i = 2; ; i++) {
      String candidate = base.value() + "-" + i;
      if (candidate.length() > 63) {
        candidate = base.value().substring(0, 63 - String.valueOf(i).length() - 1) + "-" + i;
      }
      Slug slug = Slug.of(candidate);
      if (sectors.findAliveBySlug(tenantId, floorId, slug).isEmpty()) {
        return slug;
      }
    }
  }
}
