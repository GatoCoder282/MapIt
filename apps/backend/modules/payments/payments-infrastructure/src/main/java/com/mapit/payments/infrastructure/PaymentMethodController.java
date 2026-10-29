package com.mapit.payments.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentMethodService;
import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.PaymentProvider;

/** La autorización ADMIN se aplica antes de resolver el controlador en SecurityConfig. */
@RestController
@RequestMapping("/api/v1/payment-methods")
public class PaymentMethodController {
  private final PaymentMethodService service;
  public PaymentMethodController(PaymentMethodService service) { this.service = service; }

  @GetMapping
  public List<Response> list(@RequestParam(required = false) @Nullable UUID establishmentId) {
    return service.list(establishmentId).stream().map(Response::from).toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Response create(@Valid @RequestBody Write request) { return Response.from(service.create(request.draft())); }

  @PutMapping("/{methodId}")
  public Response update(@PathVariable UUID methodId, @Valid @RequestBody Write request) {
    return Response.from(service.update(methodId, request.draft()));
  }

  @ExceptionHandler(PaymentMethodService.NotFound.class)
  ResponseEntity<ProblemDetail> notFound(PaymentMethodService.NotFound exception) {
    return problem(HttpStatus.NOT_FOUND, "payment-method-not-found", exception.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException exception) {
    // Las validaciones no reflejan la imagen ni datos de cuenta en el mensaje.
    return problem(HttpStatus.BAD_REQUEST, "payment-method-invalid", "La configuración de cobro no es válida");
  }

  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String type, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create("https://mapit.dev/problems/" + type));
    return ResponseEntity.status(status).body(problem);
  }

  public record Write(@Nullable UUID establishmentId, @NotBlank @Size(max = 120) String displayName,
      @NotBlank @Pattern(regexp = "[A-Z]{2}") String country,
      @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency, @NotNull PaymentProvider provider,
      @NotBlank @Size(max = 120) String bankName, @NotBlank @Size(max = 120) String accountReference,
      @Nullable @Size(max = 350000) String staticQrImage, @NotNull Boolean enabled,
      @Nullable @Size(min=1,max=120) String accountHolderName) {
    PaymentMethodService.Draft draft() {
      return new PaymentMethodService.Draft(establishmentId, displayName, country, currency, provider,
          bankName, accountReference, staticQrImage, Boolean.TRUE.equals(enabled), accountHolderName);
    }
  }

  public record Response(UUID id, @Nullable UUID establishmentId, String displayName, String country,
      String currency, PaymentProvider provider, String bankName, String accountReference,
      @Nullable String staticQrImage, boolean enabled, String verification, Instant createdAt, Instant updatedAt,
      @Nullable String accountHolderName) {
    static Response from(MerchantPaymentMethod m) {
      return new Response(m.id(), m.establishmentId(), m.displayName(), m.country(), m.currency(), m.provider(),
          m.bankName(), m.accountReference(), m.staticQrImage(), m.enabled(), m.verification(), m.createdAt(), m.updatedAt(), m.accountHolderName());
    }
  }
}
