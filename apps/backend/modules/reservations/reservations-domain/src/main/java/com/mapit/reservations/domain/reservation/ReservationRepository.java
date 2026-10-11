package com.mapit.reservations.domain.reservation;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto para guardar una reserva y todas sus asociaciones de forma atómica. */
public interface ReservationRepository {

  Reservation save(Reservation reservation);

  Optional<Reservation> findAliveByTenantAndEstablishmentAndId(
      TenantId tenantId, UUID establishmentId, ReservationId reservationId);

  /** Actualiza solo si el estado sigue siendo el que el caso de uso leyó. */
  boolean updateStatus(
      TenantId tenantId,
      UUID establishmentId,
      ReservationId reservationId,
      ReservationStatus expectedStatus,
      ReservationStatus nextStatus,
      UUID actorId,
      Instant updatedAt);
}
