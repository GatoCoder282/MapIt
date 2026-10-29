package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface PaymentGatewayPort {
  record Capabilities(boolean dynamicQr, boolean checkoutWeb, boolean webhooks,
      boolean statusQuery, boolean refunds, Set<String> countries, Set<String> currencies) {}
  record Session(String reference, String simulationLink, Instant expiresAt) {}
  Capabilities capabilities();
  Session createSession(UUID paymentId, Money money, Instant expiresAt);
  Optional<Payment.Outcome> query(String reference);
}
