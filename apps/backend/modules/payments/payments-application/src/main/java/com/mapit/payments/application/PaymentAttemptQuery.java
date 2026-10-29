package com.mapit.payments.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentConfigurationRepository;

@Service
public class PaymentAttemptQuery {
  private final PaymentConfigurationRepository configuration;
  public PaymentAttemptQuery(PaymentConfigurationRepository configuration) { this.configuration = configuration; }

  @Transactional(readOnly = true)
  public PaymentViews.PaymentAttempt describe(Payment payment) {
    return PaymentViews.PaymentAttempt.from(payment, configuration.quote(payment.tenantId(), payment.reservationId()).orElse(null));
  }
}
