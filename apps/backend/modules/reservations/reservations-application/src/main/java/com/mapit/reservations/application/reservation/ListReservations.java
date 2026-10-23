package com.mapit.reservations.application.reservation;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationRepository;
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

  public ListReservations(ReservationRepository reservations, TenantContext tenantContext) {
    this.reservations = reservations;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public List<Reservation> execute() {
    return reservations.findAll(tenantContext.require());
  }
}
