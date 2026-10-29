package com.mapit.payments.domain;

/** El adaptador de bootstrap usa la outbox existente dentro de la transacción. */
public interface PaymentEventPublisherPort {
  void publish(Payment payment);
}
