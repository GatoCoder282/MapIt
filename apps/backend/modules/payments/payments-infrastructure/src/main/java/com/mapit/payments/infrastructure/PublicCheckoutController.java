package com.mapit.payments.infrastructure;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentViews;
import com.mapit.payments.application.PublicCheckoutService;
import com.mapit.payments.domain.Payment;

@Validated
@RestController
@RequestMapping("/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}/reservations/{reservationId}")
public class PublicCheckoutController {
  private final PublicCheckoutService checkout;
  private final MockPaymentSimulator simulator;

  public PublicCheckoutController(PublicCheckoutService checkout, MockPaymentSimulator simulator) {
    this.checkout = checkout; this.simulator = simulator;
  }

  @GetMapping("/checkout")
  public ResponseEntity<PaymentViews.PublicCheckout> checkout(@PathVariable String tenantSlug,
      @PathVariable String establishmentSlug, @PathVariable UUID reservationId,
      @RequestHeader("X-Reservation-Access") @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token) {
    return PublicPaymentResponses.of(HttpStatus.OK, checkout.checkout(tenantSlug, establishmentSlug, reservationId, token));
  }

  @PostMapping("/payments")
  public ResponseEntity<PaymentViews.PaymentAttempt> start(@PathVariable String tenantSlug,
      @PathVariable String establishmentSlug, @PathVariable UUID reservationId,
      @RequestHeader("X-Reservation-Access") @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
      @Valid @RequestBody StartRequest request) {
    return PublicPaymentResponses.of(HttpStatus.CREATED, checkout.start(tenantSlug, establishmentSlug,
        reservationId, token, request.methodId(), request.requestId()));
  }

  @PostMapping("/payments/{paymentId}/simulate")
  public ResponseEntity<PaymentViews.PaymentAttempt> simulate(@PathVariable String tenantSlug,
      @PathVariable String establishmentSlug, @PathVariable UUID reservationId, @PathVariable UUID paymentId,
      @RequestHeader("X-Reservation-Access") @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
      @Valid @RequestBody SimulateRequest request) {
    return PublicPaymentResponses.of(HttpStatus.OK, simulator.simulate(tenantSlug, establishmentSlug,
        reservationId, token, paymentId, request.outcome(), request.eventId()));
  }

  public record StartRequest(@NotNull UUID methodId, @NotNull UUID requestId) {}
  public record SimulateRequest(@NotNull Payment.Outcome outcome, @Nullable @Size(min = 1, max = 120) String eventId) {}
}
