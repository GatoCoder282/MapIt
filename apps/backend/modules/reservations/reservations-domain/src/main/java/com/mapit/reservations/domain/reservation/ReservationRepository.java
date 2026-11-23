package com.mapit.reservations.domain.reservation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Puerto para guardar una reserva y todas sus asociaciones de forma atómica. */
public interface ReservationRepository {

  Reservation save(Reservation reservation);

  /** Reservas del tenant, de la más reciente a la más antigua. */
  List<Reservation> findAll(TenantId tenantId);

  default List<WithCustomer> findForEstablishment(
      TenantId tenantId, UUID establishmentId, @Nullable Instant endsAfter) {
    throw new UnsupportedOperationException("Consulta por establecimiento no implementada");
  }

  record WithCustomer(Reservation reservation, @Nullable String customerName) {}
}
