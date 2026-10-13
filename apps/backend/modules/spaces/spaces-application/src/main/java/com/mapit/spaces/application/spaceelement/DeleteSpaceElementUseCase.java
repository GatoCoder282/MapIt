package com.mapit.spaces.application.spaceelement;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementReservationLookup;

/**
 * Caso de uso: baja lógica de un elemento espacial (HU-4.01).
 *
 * <p>Guardas: el elemento debe ser vivo y del sector/tenant del contexto (404
 * indistinguible si no); si tiene reservas activas → 409 (RN-1: su identidad está
 * ligada a `reservation_space_element`). El lookup de reservas es un puerto del
 * dominio; el adaptador vive en `reservations` y lo cablea `bootstrap`.
 */
@Service
public class DeleteSpaceElementUseCase {

  private final SpaceElementRepository elements;
  private final SpaceElementReservationLookup reservations;
  private final TenantContext tenantContext;
  private final Clock clock;

  public DeleteSpaceElementUseCase(
      SpaceElementRepository elements,
      SpaceElementReservationLookup reservations,
      TenantContext tenantContext,
      Clock clock) {
    this.elements = elements;
    this.reservations = reservations;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional
  public void delete(UUID sectorId, UUID elementId) {
    TenantId tenantId = tenantContext.require();

    SpaceElement element =
        elements
            .findAliveById(tenantId, sectorId, SpaceElementId.of(elementId))
            .orElseThrow(() -> new SpaceElementNotFoundException(elementId));

    if (reservations.hasActiveReservations(tenantId, element.id())) {
      throw new SpaceElementHasActiveReservationsException(element.id());
    }

    elements.save(element.softDelete(clock.instant(), null));
  }
}
