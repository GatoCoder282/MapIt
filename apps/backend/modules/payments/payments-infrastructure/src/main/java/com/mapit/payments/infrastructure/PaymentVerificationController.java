package com.mapit.payments.infrastructure;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentAttemptQuery;
import com.mapit.payments.application.PaymentService;
import com.mapit.payments.application.PaymentViews;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentVerificationController {
  private final PaymentService payments;
  private final PaymentAttemptQuery query;
  public PaymentVerificationController(PaymentService payments, PaymentAttemptQuery query) { this.payments = payments; this.query = query; }

  @PostMapping("/{paymentId}/verify")
  public ResponseEntity<PaymentViews.PaymentAttempt> verify(@PathVariable UUID paymentId, @Valid @RequestBody VerifyRequest request) {
    return PublicPaymentResponses.of(HttpStatus.OK, query.describe(payments.verifyManually(paymentId, request.bankReference())));
  }

  public record VerifyRequest(@NotBlank @Size(max = 120) String bankReference) {}
}
