package com.mapit.spaces.application;


import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.Sector;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.SpaceElementType;
import com.mapit.spaces.domain.SpaceElementTypePolicy;

/**
 * Soporte compartido por los casos de uso de elementos espaciales (HU-2.03).
 *
 * <p>Centraliza la resolución de la cadena {@code tenant → sector → floor → establishment}
 * para que cada caso de uso valide la pertenencia y el vertical del sector sin duplicar
 * el patrón. El tipo de elemento se valida contra la vertical real del establecimiento que
 * contiene el sector, no contra la petición.
 */
final class SpaceElementSupport {

  private final SectorRepository sectorRepository;
  private final FloorRepository floorRepository;
  private final EstablishmentRepository establishmentRepository;

  SpaceElementSupport(
      SectorRepository sectorRepository,
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository) {
    this.sectorRepository = sectorRepository;
    this.floorRepository = floorRepository;
    this.establishmentRepository = establishmentRepository;
  }

  /**
   * Devuelve la vertical del establecimiento que aloja el sector, verificando que el
   * sector es del tenant dado.
   *
   * @throws SectorNotFoundException cuando el sector no existe vivo o es de otro tenant.
   *         No se distingue "existe en otro tenant" para no filtrar existencia ajena.
   */
  EstablishmentType verticalDelSector(TenantId tenantId, SectorId sectorId) {
    Sector sector =
        sectorRepository
            .findAliveById(tenantId, sectorId)
            .orElseThrow(() -> new SectorNotFoundException(sectorId.value()));
    var floor =
        floorRepository
            .findAliveById(tenantId, sector.floorId())
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Sector " + sectorId + " apunta a un piso inexistente o dado de baja"));
    var establishment =
        establishmentRepository
            .findAliveById(tenantId, floor.establishmentId())
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Piso " + floor.id() + " apunta a un establecimiento inexistente"));
    return establishment.type();
  }

  /** Valida tipo contra la vertical del sector; lanza 400 si no aplica (RN-4). */
  void validarTipoPermitido(EstablishmentType vertical, SpaceElementType type) {
    if (!SpaceElementTypePolicy.esPermitido(vertical, type)) {
      throw new InvalidElementTypeForVerticalException(vertical, type);
    }
  }
}
