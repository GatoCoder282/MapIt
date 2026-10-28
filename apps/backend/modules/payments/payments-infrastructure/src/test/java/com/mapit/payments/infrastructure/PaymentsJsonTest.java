package com.mapit.payments.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.payments.application.PaymentViews;

import tools.jackson.databind.json.JsonMapper;

class PaymentsJsonTest {
  @Test
  void campos_nullable_requeridos_se_conservan_con_mapper_global_non_null() {
    var mapper = JsonMapper.builder()
        .changeDefaultPropertyInclusion(value -> value.withValueInclusion(JsonInclude.Include.NON_NULL))
        .addModule(new PaymentsJsonConfiguration().paymentsJsonModule()).build();
    var checkout = new PaymentViews.PublicCheckout(null, false, "PAYMENT_POLICY_DISABLED", null, null, null, "0", null, List.of(), null, null);
    var json = mapper.readTree(mapper.writeValueAsString(checkout));
    assertThat(json.has("amount")).isTrue();
    assertThat(json.get("amount").isNull()).isTrue();
    assertThat(json.has("totalAmount")).isTrue();
    assertThat(json.has("balanceAmount")).isTrue();
    assertThat(json.has("payment")).isTrue();
    assertThat(json.has("historicalMethod")).isTrue();
    var receipt = new PaymentViews.PaymentReceipt(null, null, null, null, "10.00", "USD", null, null, "NOT_CHECKED_IN", null);
    var receiptJson = mapper.readTree(mapper.writeValueAsString(receipt));
    assertThat(receiptJson.has("token")).isFalse();
    assertThat(receiptJson.has("url")).isFalse();
    assertThat(receiptJson.has("totalAmount")).isTrue();
    assertThat(receiptJson.has("balanceAmount")).isTrue();
  }
}
