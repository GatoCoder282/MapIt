package com.mapit.payments.domain;

import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

public interface PaymentConfigurationRepository {
  boolean lockEstablishment(TenantId tenantId, UUID establishmentId);
  Optional<PaymentPolicy> policy(TenantId tenantId, UUID establishmentId);
  PaymentPolicy savePolicy(PaymentPolicy policy);
  Optional<ReservationPaymentQuote> quote(TenantId tenantId, UUID reservationId);
  ReservationPaymentQuote insertQuote(ReservationPaymentQuote quote);
}
