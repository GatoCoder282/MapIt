package com.mapit.payments.domain;

import java.time.Instant;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Bootstrap conecta snapshots de política y transiciones autoritativas de Reservations. */
public interface ReservationPaymentPort {
  record Quote(UUID establishmentId, UUID reservationId, Money deposit, Instant expiresAt) {}
  Quote quote(TenantId tenantId, UUID reservationId);
  /** Confirmar atómicamente una reserva válida; false exige conciliación. */
  boolean confirm(Payment payment);
}
