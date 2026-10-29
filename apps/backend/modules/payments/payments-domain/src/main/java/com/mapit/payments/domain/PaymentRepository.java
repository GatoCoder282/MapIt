package com.mapit.payments.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

public interface PaymentRepository {
  Payment insert(Payment payment);
  Payment insert(Payment payment, UUID requestId);
  void addRequestAlias(Payment payment, UUID requestId);
  Optional<Payment> find(TenantId tenantId, UUID paymentId);
  Optional<Payment> findByRequest(TenantId tenantId, UUID reservationId, UUID requestId);
  Optional<Payment> latest(TenantId tenantId, UUID reservationId);
  List<Payment> pending(TenantId tenantId, UUID reservationId);
  Optional<Payment> confirmed(TenantId tenantId, UUID reservationId);
  Optional<Payment> reconciliationRequired(TenantId tenantId, UUID reservationId);
  Optional<Payment> lock(TenantId tenantId, UUID paymentId);
  void update(Payment payment);
  boolean recordEvent(Payment payment, String eventId, Payment.Outcome outcome, Instant receivedAt);
  void recordVerification(Payment payment, @Nullable UUID actor, String source, String reference, Instant now);
}
