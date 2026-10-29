package com.mapit.payments.infrastructure;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.payments.application.PaymentLedgerService;
import com.mapit.payments.application.PaymentViews;

import tools.jackson.databind.module.SimpleModule;

/** Los null del contrato expresan total desconocido, sin cambiar el mapper global. */
@Configuration
public class PaymentsJsonConfiguration {
  @Bean
  SimpleModule paymentsJsonModule() {
    SimpleModule module = new SimpleModule("mapit-payments-contract");
    module.setMixInAnnotation(PaymentViews.PublicCheckout.class, NullableFields.class);
    module.setMixInAnnotation(PaymentViews.PaymentAttempt.class, NullableFields.class);
    module.setMixInAnnotation(PaymentViews.PaymentReceipt.class, ReceiptFields.class);
    module.setMixInAnnotation(PaymentPolicyController.Response.class, NullableFields.class);
    module.setMixInAnnotation(PaymentLedgerService.ManagedPayment.class, NullableFields.class);
    module.setMixInAnnotation(PaymentMethodController.Response.class, NullableFields.class);
    module.setMixInAnnotation(PaymentReadinessController.Response.class, NullableFields.class);
    module.setMixInAnnotation(com.mapit.payments.domain.PaymentReservationAccessPort.Space.class, NullableFields.class);
    return module;
  }

  @JsonInclude(JsonInclude.Include.ALWAYS)
  private abstract static class NullableFields {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  private abstract static class ReceiptFields {
    @JsonInclude(JsonInclude.Include.ALWAYS) abstract String totalAmount();
    @JsonInclude(JsonInclude.Include.ALWAYS) abstract String balanceAmount();
  }
}
