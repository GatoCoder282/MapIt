package com.mapit.payments.infrastructure;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentPolicyService;
import com.mapit.payments.domain.PaymentPolicy;

@RestController
@RequestMapping("/api/v1/establishments")
public class PaymentPolicyController {
  private final PaymentPolicyService service;
  public PaymentPolicyController(PaymentPolicyService service) { this.service = service; }

  @GetMapping("/{establishmentId}/payment-policy")
  public ResponseEntity<Response> get(@PathVariable UUID establishmentId) {
    return service.get(establishmentId)
        .map(p -> ResponseEntity.ok(Response.from(p)))
        .orElseThrow(PaymentPolicyService.NotFound::new);
  }

  @PutMapping("/{establishmentId}/payment-policy")
  public Response save(@PathVariable UUID establishmentId, @Valid @RequestBody Write request) {
    PaymentPolicy policy = service.save(establishmentId, request.enabled(), request.currency(),
        new BigDecimal(request.depositAmount()), request.totalAmount() == null ? null : new BigDecimal(request.totalAmount()), request.paymentWindowMinutes());
    return Response.from(policy);
  }

  @ExceptionHandler(PaymentPolicyService.NotFound.class)
  ResponseEntity<ProblemDetail> notFound(PaymentPolicyService.NotFound exception) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setType(java.net.URI.create("https://mapit.dev/problems/payment-policy-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException exception) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Configuración de pago inválida");
    problem.setType(java.net.URI.create("https://mapit.dev/problems/payment-policy-invalid"));
    return ResponseEntity.badRequest().body(problem);
  }

  public record Write(@NotNull Boolean enabled, @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
      @NotNull @Pattern(regexp = "^[0-9]+(\\.[0-9]{1,6})?$") String depositAmount,
      @Nullable @Pattern(regexp = "^[0-9]+(\\.[0-9]{1,6})?$") String totalAmount,
      @Min(5) @Max(120) int paymentWindowMinutes) {}

  public record Response(boolean enabled, String currency,
      String depositAmount, @Nullable String totalAmount, int paymentWindowMinutes) {
    static Response from(PaymentPolicy p) {
      return new Response(p.enabled(), p.deposit().currency(),
          p.deposit().amount().toPlainString(), p.total() == null ? null : p.total().amount().toPlainString(), p.paymentWindowMinutes());
    }
  }
}
