package com.mapit.payments.infrastructure;

import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.mapit.payments.application.PaymentReadinessService;
import com.mapit.payments.application.PaymentReadinessView;

@RestController
public class PaymentReadinessController {
  private final PaymentReadinessService service;
  private final com.mapit.shared.security.ActorContext actors;
  public PaymentReadinessController(PaymentReadinessService service, com.mapit.shared.security.ActorContext actors) { this.service=service; this.actors=actors; }
  @GetMapping("/api/v1/establishments/{establishmentId}/payment-readiness")
  public ResponseEntity<Response> get(@PathVariable UUID establishmentId, HttpServletRequest request) {
    if(request.getUserPrincipal()==null || actors.currentUserId().isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    if(!request.isUserInRole("ADMIN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    var result=service.read(establishmentId);
    return PublicPaymentResponses.of(HttpStatus.OK,new Response(result.establishmentId(),result.qrEnabled(),
        result.policy()==null ? null : PaymentPolicyController.Response.from(result.policy()),result.ready(),result.blockers()));
  }
  public record Response(UUID establishmentId, boolean qrEnabled, PaymentPolicyController.@Nullable Response policy,
      boolean ready, List<PaymentReadinessView.Blocker> blockers) {}
}
