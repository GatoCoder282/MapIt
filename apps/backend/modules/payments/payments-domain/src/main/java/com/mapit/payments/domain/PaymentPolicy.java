package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Anticipo fijo por reserva, configurado expresamente por el administrador. */
public record PaymentPolicy(UUID id, TenantId tenantId, UUID establishmentId, boolean enabled,
    Money deposit, @Nullable Money total, int paymentWindowMinutes, Instant updatedAt, UUID updatedBy) {
  public PaymentPolicy {
    Objects.requireNonNull(id); Objects.requireNonNull(tenantId); Objects.requireNonNull(establishmentId);
    Objects.requireNonNull(deposit); Objects.requireNonNull(updatedAt); Objects.requireNonNull(updatedBy);
    if (paymentWindowMinutes < 5 || paymentWindowMinutes > 120) throw new IllegalArgumentException("Ventana de pago inválida");
    if (total != null && (!total.currency().equals(deposit.currency()) || total.amount().compareTo(deposit.amount()) < 0)) {
      throw new IllegalArgumentException("El total no puede ser menor al anticipo ni usar otra moneda");
    }
  }
}
