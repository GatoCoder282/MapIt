package com.mapit.payments.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentGatewayPort;

/** Mantiene operativos los QR manuales sin atribuir capacidades a una pasarela ausente. */
public final class UnavailablePaymentGateway implements PaymentGatewayPort {
  public Capabilities capabilities() { return new Capabilities(false, false, false, false, false, Set.of(), Set.of()); }
  public Session createSession(UUID paymentId, Money money, Instant expiresAt) { throw new MockPaymentSettings.Disabled(); }
  public Optional<Payment.Outcome> query(String reference) { throw new MockPaymentSettings.Disabled(); }
}
