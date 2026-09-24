package com.mapit.spaces.application.spaceelement;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.SectorId;
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
    var vertical = support.verticalDelSector(tenantId, new SectorId(command.sectorId()));

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
