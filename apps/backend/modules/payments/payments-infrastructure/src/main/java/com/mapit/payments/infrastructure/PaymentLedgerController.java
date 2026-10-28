package com.mapit.payments.infrastructure;

import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.payments.application.PaymentLedgerService;
import com.mapit.payments.domain.Payment;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentLedgerController {
  private final PaymentLedgerService ledger;
  public PaymentLedgerController(PaymentLedgerService ledger){this.ledger=ledger;}
  @GetMapping
  public ResponseEntity<PaymentLedgerService.PaymentPage> list(@RequestParam UUID establishmentId,
      @RequestParam(required=false) Payment.@Nullable Status status,
      @RequestParam(defaultValue="20") int limit,@RequestParam(defaultValue="0") int offset){
    return PublicPaymentResponses.of(HttpStatus.OK,ledger.list(establishmentId,status,limit,offset));
  }
}
