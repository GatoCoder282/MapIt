package com.mapit.payments.infrastructure;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.UUID;

import com.mapit.payments.application.PaymentService.VerifiedEvent;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.ObjectMapper;

/** Contrato de pruebas: tenant, comercio y monto se interpretan exclusivamente tras validar HMAC. */
public final class MockWebhookCodec {
  private final MockWebhookAuthenticator authenticator;
  private final ObjectMapper mapper;
  private final Clock clock;

  public MockWebhookCodec(MockWebhookAuthenticator authenticator, ObjectMapper mapper, Clock clock) {
    this.authenticator = authenticator; this.mapper = mapper; this.clock = clock;
  }

  public record Notification(long timestamp, String signature, byte[] body) {
    public Notification { body = body.clone(); }
    @Override public byte[] body() { return body.clone(); }
  }

  public Notification encodeForSimulation(VerifiedEvent event) {
    Wire wire = new Wire(event.tenantId().value(), event.paymentId(), event.eventId(), event.externalReference(),
        event.merchantReference(), event.money().amount(), event.money().currency(), event.outcome());
    byte[] body = mapper.writeValueAsBytes(wire);
    long timestamp = clock.instant().getEpochSecond();
    return new Notification(timestamp, authenticator.sign(timestamp, body), body);
  }

  public VerifiedEvent decode(Notification notification) {
    byte[] body = notification.body();
    authenticator.verify(notification.timestamp(), body, notification.signature());
    try {
      Wire wire = mapper.readValue(body, Wire.class);
      return new VerifiedEvent(TenantId.of(wire.tenantId()), wire.paymentId(), PaymentProvider.MOCK_GATEWAY,
          wire.eventId(), wire.externalReference(), wire.merchantReference(), new Money(wire.amount(), wire.currency()), wire.outcome());
    } catch (RuntimeException exception) {
      throw new IllegalArgumentException("Cuerpo de webhook inválido");
    }
  }

  public record Wire(String tenantId, UUID paymentId, String eventId, String externalReference,
      String merchantReference, BigDecimal amount, String currency, Payment.Outcome outcome) {}
}
