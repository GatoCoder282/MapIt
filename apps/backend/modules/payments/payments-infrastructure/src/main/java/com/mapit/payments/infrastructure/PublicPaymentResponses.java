package com.mapit.payments.infrastructure;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

final class PublicPaymentResponses {
  private PublicPaymentResponses() {}
  static <T> ResponseEntity<T> of(HttpStatus status, T body) {
    return ResponseEntity.status(status).header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer").body(body);
  }
}
