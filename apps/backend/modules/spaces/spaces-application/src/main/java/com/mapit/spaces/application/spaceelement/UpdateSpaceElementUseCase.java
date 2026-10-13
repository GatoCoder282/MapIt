package com.mapit.spaces.application.spaceelement;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;

/** Caso de uso: actualizar tipo y coordenadas de un elemento espacial (HU-2.03 / MAP-114).
 *
 * <p>PUT reemplaza los campos editables. El estado no se actualiza aquí (transiciones
 * auditadas = HU-3.01). La cadena sector→elemento se re-verifica contra el tenant del
 * contexto: un id de otro tenant no se distingue de uno inexistente (404 en ambos casos).
 */
@Service
public class UpdateSpaceElementUseCase {

  private final SpaceElementRepository repository;
  private final SpaceElementSupport support;
  private final TenantContext tenantContext;
  private final Clock clock;

  public UpdateSpaceElementUseCase(
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
  public SpaceElementResponse update(UpdateSpaceElementCommand command) {
    TenantId tenantId = tenantContext.require();

    // El elemento solo se toca si el sector es del tenant activo; con el sector verificado,
    // cualquier elemento no-vivo o ajeno cae en el 404 sin distinguir existencia.
    var sectorId = new SectorId(command.sectorId());
    var vertical = support.verticalDelSector(tenantId, sectorId);

    SpaceElementType type = support.parseType(command.type());
    support.validarTipoPermitido(vertical, type);

    // HU-4.01 (RN-10): la nueva geometría debe caber en las dimensiones reales del sector.
    if (command.x() != null && command.y() != null
        && command.width() != null && command.height() != null) {
      support.validarQueCabeEnElSector(
          support.sectorVivo(tenantId, sectorId),
          command.x(), command.y(), command.width(), command.height(),
          command.rotation() != null ? command.rotation() : 0);
    }

    SpaceElement existing =
        repository
            .findAliveById(tenantId, command.sectorId(), new SpaceElementId(command.elementId()))
            .orElseThrow(() -> new SpaceElementNotFoundException(command.elementId()));

    SpaceElement saved =
        repository.save(
            existing.update(type, command.x(), command.y(), command.width(), command.height(), command.rotation(), clock.instant(), null));
    return SpaceElementResponse.fromDomain(saved);
  }
}
