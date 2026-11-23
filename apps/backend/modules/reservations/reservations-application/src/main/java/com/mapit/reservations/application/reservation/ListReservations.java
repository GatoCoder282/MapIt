package com.mapit.reservations.application.reservation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantContext;

/**
 * Lista las reservas del tenant autenticado.
 *
 * <p>La transacción (aunque sea de solo lectura) no es opcional: el adaptador fija el
 * tenant de la sesión con {@code SET LOCAL} para que la RLS de PostgreSQL deje pasar
 * sus filas, y esa fijación solo sobrevive dentro de la misma transacción.
 */
@Service
public class ListReservations {

  private final ReservationRepository reservations;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final EstablishmentAuthorizationPort authorization;

  public ListReservations(
      ReservationRepository reservations,
      TenantContext tenantContext,
      ActorContext actorContext,
      EstablishmentAuthorizationPort authorization) {
    this.reservations = reservations;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.authorization = authorization;
  }

  @Transactional(readOnly = true)
  public List<Reservation> execute() {
    return reservations.findAll(tenantContext.require());
  }

  @Transactional(readOnly = true)
  public List<ReservationRepository.WithCustomer> execute(
      UUID establishmentId, @Nullable Instant endsAfter) {
    var tenantId = tenantContext.require();
    if (!authorization.canReadOperations(tenantId, actorContext.requireUserId(), establishmentId)) {
      throw new ReservationReferenceNotFoundException(
          ReservationReferenceNotFoundException.Reference.ESTABLISHMENT, establishmentId);
    }
    return reservations.findForEstablishment(tenantId, establishmentId, endsAfter);
  }
}
