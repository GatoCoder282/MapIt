package com.mapit.spaces.application;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.SpaceElement;
import com.mapit.spaces.domain.SpaceElementId;
import com.mapit.spaces.domain.SpaceElementRepository;
import com.mapit.spaces.domain.SpaceElementType;

/** Caso de uso: dar de alta un elemento espacial dentro de un sector (HU-2.03 / MAP-114).
 *
 * <p>Toda validación ocurre antes de persistir: el tenant sale del contexto (nunca del
 * cuerpo), el sector se re-verifica contra ese tenant, el tipo contra la vertical del
 * establecimiento del sector, y las invariantes de dominio se ejecutan en el record.
 */
@Service
public class CreateSpaceElementUseCase {

  private final SpaceElementRepository repository;
  private final SpaceElementSupport support;
  private final TenantContext tenantContext;

  public CreateSpaceElementUseCase(
      SpaceElementRepository repository,
      SectorRepository sectorRepository,
      FloorRepository floorRepository,
      EstablishmentRepository establishmentRepository,
      TenantContext tenantContext) {
    this.repository = repository;
    this.support =
        new SpaceElementSupport(sectorRepository, floorRepository, establishmentRepository);
    this.tenantContext = tenantContext;
  }

  @Transactional
  public SpaceElementResponse create(CreateSpaceElementCommand command) {
    TenantId tenantId = tenantContext.require();

    // Sector debe existir y ser del tenant actual; la vertical se toma de su establecimiento.
    EstablishmentType vertical =
        support.verticalDelSector(tenantId, new SectorId(command.sectorId()));

    SpaceElementType type = parseType(command.type());
    support.validarTipoPermitido(vertical, type);

    SpaceElementState initialState = parseState(command.initialState());

    SpaceElement saved =
        repository.save(
            SpaceElement.register(
                SpaceElementId.generate(),
                tenantId,
                command.sectorId(),
                type,
                command.x(),
                command.y(),
                initialState,
                Instant.now(),
                null));
    return toResponse(saved);
  }

  private SpaceElementType parseType(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("type es obligatorio");
    }
    try {
      return SpaceElementType.valueOf(raw);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "type inválido: '%s'. Valores: TABLE, BAR, SECTOR_ZONE, STAGE, SEAT, ROOM, DECOR"
              .formatted(raw));
    }
  }

  private SpaceElementState parseState(String raw) {
    if (raw == null || raw.isBlank()) {
      return SpaceElementState.AVAILABLE;
    }
    try {
      return SpaceElementState.valueOf(raw);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "initialState inválido: '%s'. Valores: AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE"
              .formatted(raw));
    }
  }

  static SpaceElementResponse toResponse(SpaceElement element) {
    var audit = element.audit();
    return new SpaceElementResponse(
        element.id().value(),
        element.sectorId(),
        element.type().name(),
        element.x(),
        element.y(),
        element.state().name(),
        audit.createdAt(),
        audit.updatedAt());
  }
}
