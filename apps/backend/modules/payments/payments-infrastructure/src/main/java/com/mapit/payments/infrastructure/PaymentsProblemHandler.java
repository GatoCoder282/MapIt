package com.mapit.payments.infrastructure;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.mapit.payments.application.PaymentMethodService;
import com.mapit.payments.application.PaymentService;

@RestControllerAdvice(basePackageClasses = PublicCheckoutController.class)
public class PaymentsProblemHandler {
  @ExceptionHandler(MockPaymentWebhookController.PayloadTooLarge.class)
  ResponseEntity<ProblemDetail> oversized() { return problem(HttpStatus.CONTENT_TOO_LARGE, "payment-webhook-too-large", "El webhook supera el límite de 16384 bytes"); }

  @ExceptionHandler(PaymentMethodService.NotFound.class)
  ResponseEntity<ProblemDetail> missing() { return problem(HttpStatus.NOT_FOUND, "payment-not-found", "Recurso no encontrado"); }

  @ExceptionHandler(PaymentService.Conflict.class)
  ResponseEntity<ProblemDetail> conflict() { return problem(HttpStatus.CONFLICT, "payment-conflict", "El estado actual no admite esta operación de pago"); }

  @ExceptionHandler(MockPaymentSettings.Disabled.class)
  ResponseEntity<ProblemDetail> disabled() { return problem(HttpStatus.NOT_FOUND, "payment-not-found", "Recurso no encontrado"); }

  @ExceptionHandler(SecurityException.class)
  ResponseEntity<ProblemDetail> signature() { return problem(HttpStatus.UNAUTHORIZED, "payment-signature-invalid", "Notificación de pago no autenticada"); }

  @ExceptionHandler(MockPaymentSimulator.DeliveryFailed.class)
  ResponseEntity<ProblemDetail> delivery() { return problem(HttpStatus.BAD_GATEWAY, "payment-notification-failed", "No se pudo entregar la notificación de la pasarela"); }

  @ExceptionHandler({IllegalArgumentException.class, ArithmeticException.class})
  ResponseEntity<ProblemDetail> invalid() { return problem(HttpStatus.BAD_REQUEST, "payment-invalid", "Datos de pago inválidos"); }

  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create("https://mapit.dev/problems/" + type));
    return PublicPaymentResponses.of(status, problem);
  }
}
