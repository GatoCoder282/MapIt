package com.mapit.spaces.application.spaceelement;

import org.springframework.stereotype.Service;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.domain.spaceelement.SpaceElementTypePolicy;

/**
 * Soporte compartido de los casos de uso de elementos espaciales (HU-2.03).
 *
 * <p>Centraliza la resolución de la cadena {@code tenant → sector → floor → establishment}
 * y el parseo del tipo, para que ningún caso de uso repita ese patrón. El tipo de elemento
 * se valida contra la vertical **real** del establecimiento que contiene al sector.
 */
@Service
public class SpaceElementSupport {

  private final SectorRepository sectorRepository;
  private final FloorRepository floorRepository;
  private final EstablishmentRepository establishmentRepository;

  public SpaceElementSupport(
      SectorRepository sectorRepository,
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository) {
    this.sectorRepository = sectorRepository;
    this.floorRepository = floorRepository;
    this.establishmentRepository = establishmentRepository;
  }

  /**
   * Devuelve la vertical del establecimiento que aloja el sector, verificando que el sector
   * es vivo y del tenant dado.
   *
   * @throws SectorNotFoundException cuando el sector no existe o es de otro tenant; no se
   *         distingue entre ambos casos para no filtrar existencia ajena.
   */
  public EstablishmentType verticalDelSector(TenantId tenantId, SectorId sectorId) {
    var sector = sectorVivo(tenantId, sectorId);
    var floor =
        floorRepository
            .findAliveById(tenantId, sector.floorId())
            .orElseThrow(
                () ->
                     new SectorNotFoundException(sectorId.value()));
    var establishment =
        establishmentRepository
            .findAliveById(tenantId, floor.establishmentId())
            .orElseThrow(
                () ->
                     new SectorNotFoundException(sectorId.value()));
    return establishment.type();
  }

  /** Sector vivo del tenant o error indistinguible. */
  public com.mapit.spaces.domain.sector.Sector sectorVivo(TenantId tenantId, SectorId sectorId) {
    return sectorRepository
        .findAliveById(tenantId, sectorId)
        .orElseThrow(() -> new SectorNotFoundException(sectorId.value()));
  }

  /**
   * HU-4.01 (RN-10): un elemento debe caber dentro de las dimensiones reales del sector,
   * contando su rotación (misma fórmula que el clamping del canvas).
   */
  public void validarQueCabeEnElSector(
      com.mapit.spaces.domain.sector.Sector sector,
      double x, double y, double width, double height, double rotation) {
    var posicion = com.mapit.spaces.domain.layout.Placement.of(x, y, rotation);
    var tamano = com.mapit.spaces.domain.layout.Geometry.of(width, height);
    if (!posicion.fitsIn(tamano, sector.geometry().width(), sector.geometry().height())) {
      throw new IllegalArgumentException(
          "El elemento no cabe en el sector (sector %sx%s, elemento en x=%s y=%s, %sx%s rotado %s°)"
              .formatted(sector.geometry().width(), sector.geometry().height(), x, y, width, height, rotation));
    }
  }

  /** Lanza 400 si el tipo no es válido para la vertical (RN-4). Solo se toca aquí. */
  public void validarTipoPermitido(EstablishmentType vertical, SpaceElementType type) {
    if (!SpaceElementTypePolicy.esPermitido(vertical, type)) {
      throw new InvalidElementTypeForVerticalException(vertical, type);
    }
  }

  /** Parseo del tipo del body con mensaje uniforme. Centralizado para no duplicarse. */
  public SpaceElementType parseType(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("type es obligatorio");
    }
    try {
      return SpaceElementType.valueOf(raw);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "type inválido: '%s'. Valores: %s"
              .formatted(raw, java.util.Arrays.toString(SpaceElementType.values())));
    }
  }
}
