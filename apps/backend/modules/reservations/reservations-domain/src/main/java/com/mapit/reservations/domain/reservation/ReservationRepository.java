package com.mapit.reservations.domain.reservation;

import java.util.List;

import com.mapit.shared.tenant.TenantId;

/** Puerto para guardar una reserva y todas sus asociaciones de forma atómica. */
public interface ReservationRepository {

  Reservation save(Reservation reservation);

  /** Reservas del tenant, de la más reciente a la más antigua. */
  List<Reservation> findAll(TenantId tenantId);
}
