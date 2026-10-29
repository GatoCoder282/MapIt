package com.mapit.payments.infrastructure;

import java.util.UUID;

import jakarta.validation.constraints.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentReceiptService;
import com.mapit.payments.application.PaymentViews;

@Validated
@RestController
@RequestMapping("/api/v1/public/tenants/{tenantSlug}/establishments/{establishmentSlug}")
public class PaymentReceiptController {
  private final PaymentReceiptService receipts;
  public PaymentReceiptController(PaymentReceiptService receipts) { this.receipts = receipts; }

  @PostMapping("/reservations/{reservationId}/receipt")
  public ResponseEntity<PaymentViews.PaymentReceipt> issue(@PathVariable String tenantSlug,
      @PathVariable String establishmentSlug, @PathVariable UUID reservationId,
      @RequestHeader("X-Reservation-Access") @Pattern(regexp = "[A-Za-z0-9_-]{43}") String capability) {
    return PublicPaymentResponses.of(HttpStatus.CREATED, receipts.issue(tenantSlug, establishmentSlug, reservationId, capability));
  }

  @GetMapping("/receipts/{token}")
  public ResponseEntity<PaymentViews.PaymentReceipt> read(@PathVariable String tenantSlug,
      @PathVariable String establishmentSlug, @PathVariable @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token) {
    return PublicPaymentResponses.of(HttpStatus.OK, receipts.read(tenantSlug, establishmentSlug, token));
  }
}
