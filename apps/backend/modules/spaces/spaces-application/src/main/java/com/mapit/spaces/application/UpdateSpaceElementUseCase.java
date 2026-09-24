package com.mapit.spaces.application;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SpaceElement;
import com.mapit.spaces.domain.SpaceElementId;
import com.mapit.spaces.domain.SpaceElementRepository;
import com.mapit.spaces.domain.SpaceElementType;

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
    var vertical = support.verticalDelSector(tenantId, new SectorId(command.sectorId()));

    SpaceElementType type = support.parseType(command.type());
    support.validarTipoPermitido(vertical, type);

    SpaceElement existing =
        repository
            .findAliveById(tenantId, command.sectorId(), new SpaceElementId(command.elementId()))
            .orElseThrow(() -> new SpaceElementNotFoundException(command.elementId()));

    SpaceElement saved =
        repository.save(
            existing.update(type, command.x(), command.y(), clock.instant(), null));
    return SpaceElementResponse.fromDomain(saved);
  }
}
