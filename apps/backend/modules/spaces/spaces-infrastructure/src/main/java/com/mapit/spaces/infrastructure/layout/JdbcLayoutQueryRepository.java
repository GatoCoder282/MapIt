package com.mapit.spaces.infrastructure.layout;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.layout.FloorLayout;
import com.mapit.spaces.domain.layout.LayoutQueryRepository;
import com.mapit.spaces.domain.layout.SectorLayout;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;

/**
 * Lectura agregada del layout de una planta (HU-4.01, RN-3).
 *
 * <p>Compone los puertos del dominio (piso + sectores + elementos por sector); Ruling
 * del plan: la composición vía puertos existentes (1 + S consultas) evita SQL nuevo y
 * reutiliza el aislamiento ya probado de cada adaptador. El fan-out era del cliente;
 * ahora es interno.
 */
@Repository
public class JdbcLayoutQueryRepository implements LayoutQueryRepository {

  private final FloorRepository floors;
  private final SectorRepository sectors;
  private final SpaceElementRepository elements;

  public JdbcLayoutQueryRepository(
      FloorRepository floors,
      SectorRepository sectors,
      SpaceElementRepository elements) {
    this.floors = floors;
    this.sectors = sectors;
    this.elements = elements;
  }

  @Override
  public Optional<FloorLayout> findFloorLayout(TenantId tenantId, UUID floorId) {
    return floors
        .findAliveById(tenantId, floorId)
        .map(floor -> new FloorLayout(
            floor,
            sectors.findAliveByFloorId(tenantId, floorId).stream()
                .map(sector -> new SectorLayout(
                    sector,
                    elements.findAliveBySectorId(tenantId, sector.id().value())))
                .toList()));
  }
}
