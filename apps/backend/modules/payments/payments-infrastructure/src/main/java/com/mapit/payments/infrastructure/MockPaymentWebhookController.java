package com.mapit.payments.infrastructure;

import java.io.IOException;
import java.time.Clock;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentAttemptQuery;
import com.mapit.payments.application.PaymentService;
import com.mapit.payments.application.PaymentViews;

import tools.jackson.databind.ObjectMapper;

@RestController
public class MockPaymentWebhookController {
  private final MockPaymentSettings settings;
  private final ObjectMapper mapper;
  private final Clock clock;
  private final PaymentService payments;
  private final PaymentAttemptQuery query;

  public MockPaymentWebhookController(MockPaymentSettings settings, ObjectMapper mapper, Clock clock,
      PaymentService payments, PaymentAttemptQuery query) {
    this.settings = settings; this.mapper = mapper; this.clock = clock; this.payments = payments; this.query = query;
  }

  @PostMapping(value = "/api/v1/public/payments/mock/webhook", consumes = "application/json")
  public ResponseEntity<PaymentViews.PaymentAttempt> receive(@RequestHeader("X-Mock-Timestamp") String timestamp,
      @RequestHeader("X-Mock-Signature") String signature, HttpServletRequest request) throws IOException {
    settings.requireAllowed();
    if (request.getContentLengthLong() > 16384) throw new PayloadTooLarge();
    byte[] body = request.getInputStream().readNBytes(16385);
    if (body.length > 16384) throw new PayloadTooLarge();
    long seconds;
    try { seconds = Long.parseLong(timestamp); } catch (NumberFormatException exception) { throw new SecurityException("Firma inválida"); }
    MockWebhookCodec codec = new MockWebhookCodec(settings.authenticator(), mapper, clock);
    PaymentService.VerifiedEvent event = codec.decode(new MockWebhookCodec.Notification(seconds, signature, body));
    return PublicPaymentResponses.of(HttpStatus.OK, query.describe(payments.process(event)));
  }

  public static class PayloadTooLarge extends RuntimeException {}
}
