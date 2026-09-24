package com.mapit.spaces.application.spaceelement;

import org.springframework.stereotype.Service;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.SpaceElementType;
import com.mapit.spaces.domain.SpaceElementTypePolicy;

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
    var sector =
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
