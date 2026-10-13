package com.mapit.spaces.application.spaceelement;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;

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
  private final Clock clock;

  public CreateSpaceElementUseCase(
      SpaceElementRepository repository,
      SpaceElementSupport support,
      TenantContext tenantContext,
      Clock clock) {
    this.repository = repository;
    this.support = support;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public SpaceElementResponse create(CreateSpaceElementCommand command) {
    TenantId tenantId = tenantContext.require();

    // Sector debe existir y ser del tenant actual; la vertical se toma de su establecimiento.
    var sectorId = new SectorId(command.sectorId());
    var vertical = support.verticalDelSector(tenantId, sectorId);
    // HU-4.01 (RN-10): el elemento debe caber en las dimensiones reales del sector.
    if (command.x() != null && command.y() != null
        && command.width() != null && command.height() != null) {
      support.validarQueCabeEnElSector(
          support.sectorVivo(tenantId, sectorId),
          command.x(), command.y(), command.width(), command.height(),
          command.rotation() != null ? command.rotation() : 0.0);
    }

    SpaceElementType type = support.parseType(command.type());
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
                command.width(),
                command.height(),
                command.rotation(),
                initialState,
                clock.instant(),
                null));
    return SpaceElementResponse.fromDomain(saved);
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
}
