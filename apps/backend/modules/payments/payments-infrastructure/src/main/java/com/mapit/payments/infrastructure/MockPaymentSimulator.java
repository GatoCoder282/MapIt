package com.mapit.payments.infrastructure;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.mapit.payments.application.PaymentService.VerifiedEvent;
import com.mapit.payments.application.PaymentViews;
import com.mapit.payments.application.PublicCheckoutService;
import com.mapit.payments.domain.Payment;

import tools.jackson.databind.ObjectMapper;

/** Proveedor simulado: obtiene el cobro persistido y entrega HTTP firmado al mismo webhook. */
@Service
public class MockPaymentSimulator {
  private final MockPaymentSettings settings;
  private final PublicCheckoutService checkout;
  private final ObjectMapper mapper;
  private final Clock clock;
  private final Environment environment;
  private final RestClient client;

  public MockPaymentSimulator(MockPaymentSettings settings, PublicCheckoutService checkout,
      ObjectMapper mapper, Clock clock, Environment environment) {
    this.settings = settings; this.checkout = checkout; this.mapper = mapper;
    this.clock = clock; this.environment = environment;
    HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(Duration.ofSeconds(10));
    client = RestClient.builder().requestFactory(factory).build();
  }

  public PaymentViews.PaymentAttempt simulate(String tenantSlug, String establishmentSlug, UUID reservationId,
      String capability, UUID paymentId, Payment.Outcome outcome, @Nullable String eventId) {
    settings.requireAllowed();
    Payment payment = checkout.paymentForSimulation(tenantSlug, establishmentSlug, reservationId, capability, paymentId);
    VerifiedEvent event = new VerifiedEvent(payment.tenantId(), payment.id(), payment.provider(),
        eventId == null ? UUID.randomUUID().toString() : eventId, payment.externalReference(), payment.merchantReference(), payment.money(), outcome);
    MockWebhookCodec codec = new MockWebhookCodec(settings.authenticator(), mapper, clock);
    MockWebhookCodec.Notification notification = codec.encodeForSimulation(event);
    int port = environment.getProperty("local.server.port", Integer.class,
        environment.getProperty("server.port", Integer.class, 8080));
    if (port < 1 || port > 65535) throw new DeliveryFailed();
    // Host fijo loopback y puerto de configuración; nunca Host/Forwarded ni URL del navegador.
    URI webhook = URI.create("http://127.0.0.1:" + port + "/api/v1/public/payments/mock/webhook");
    try {
      client.post().uri(webhook).contentType(MediaType.APPLICATION_JSON)
          .header("X-Mock-Timestamp", Long.toString(notification.timestamp()))
          .header("X-Mock-Signature", notification.signature())
          .body(notification.body()).retrieve().toBodilessEntity();
    } catch (RestClientException exception) {
      throw new DeliveryFailed();
    }
    return checkout.simulationResult(tenantSlug, establishmentSlug, reservationId, capability, paymentId);
  }

  public static class DeliveryFailed extends RuntimeException {
    public DeliveryFailed() { super("La pasarela mock no pudo entregar su notificación"); }
  }
}
