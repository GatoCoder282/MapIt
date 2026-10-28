package com.mapit.payments.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class PaymentTest {
  private static final Instant NOW = Instant.parse("2026-10-24T12:00:00Z");

  @Test
  void acepta_precision_iso_y_no_redondea() {
    assertThat(new Money(new BigDecimal("10"), "JPY").amount()).isEqualTo(new BigDecimal("10"));
    assertThat(new Money(new BigDecimal("10.123"), "KWD").amount()).isEqualTo(new BigDecimal("10.123"));
    assertThat(new Money(new BigDecimal("10.2"), "BOB").amount()).isEqualTo(new BigDecimal("10.20"));
    assertThatThrownBy(() -> new Money(new BigDecimal("10.01"), "JPY")).isInstanceOf(ArithmeticException.class);
    assertThatThrownBy(() -> new Money(BigDecimal.ZERO, "USD")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new Money(BigDecimal.ONE, "XXX")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new Money(new BigDecimal("1000000000000000000"), "JPY")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void ingreso_tardio_o_reserva_invalida_requieren_conciliacion() {
    Payment payment = payment(Payment.Status.PENDING);
    assertThat(payment.apply(Payment.Outcome.CONFIRMED, NOW.plusSeconds(60), true, "WEBHOOK", null).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    assertThat(payment.apply(Payment.Outcome.CONFIRMED, NOW, false, "WEBHOOK", null).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    assertThat(payment.apply(Payment.Outcome.CONFIRMED, NOW, true, "WEBHOOK", null).status())
        .isEqualTo(Payment.Status.CONFIRMED);
  }

  @Test
  void eventos_fuera_de_orden_no_degradan_pago_confirmado() {
    Payment confirmed = payment(Payment.Status.PENDING).apply(Payment.Outcome.CONFIRMED, NOW, true, "WEBHOOK", null);
    assertThat(confirmed.apply(Payment.Outcome.FAILED, NOW, false, "WEBHOOK", null)).isSameAs(confirmed);
    assertThat(confirmed.apply(Payment.Outcome.EXPIRED, NOW, false, "WEBHOOK", null)).isSameAs(confirmed);
    assertThat(payment(Payment.Status.FAILED).apply(Payment.Outcome.CONFIRMED, NOW, true, "WEBHOOK", null).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
  }

  @Test
  void cancelacion_es_terminal_distinta_y_confirmacion_posterior_requiere_conciliacion() {
    var cancelled = payment(Payment.Status.PENDING).apply(Payment.Outcome.valueOf("CANCELLED"), NOW, false, "WEBHOOK", null);
    assertThat(cancelled.status().name()).isEqualTo("CANCELLED");
    assertThat(cancelled.verifiedAt()).isNull();
    for (var outcome : new String[]{"CANCELLED", "FAILED", "EXPIRED"}) {
      assertThat(cancelled.apply(Payment.Outcome.valueOf(outcome), NOW.plusSeconds(120), false, "WEBHOOK", null)).isSameAs(cancelled);
    }
    assertThat(cancelled.apply(Payment.Outcome.CONFIRMED, NOW, true, "WEBHOOK", null).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    var confirmed = payment(Payment.Status.CONFIRMED);
    assertThat(confirmed.apply(Payment.Outcome.valueOf("CANCELLED"), NOW, false, "WEBHOOK", null)).isSameAs(confirmed);
    for (var status : new Payment.Status[]{Payment.Status.FAILED, Payment.Status.EXPIRED}) {
      var historical = payment(status);
      assertThat(historical.apply(Payment.Outcome.valueOf("CANCELLED"), NOW, false, "WEBHOOK", null)).isSameAs(historical);
    }
  }

  static Payment payment(Payment.Status status) {
    return new Payment(UUID.randomUUID(), TenantId.of("tenant-a"), UUID.randomUUID(), UUID.randomUUID(),
        UUID.randomUUID(), PaymentProvider.MOCK_GATEWAY, "merchant", "external", new Money(BigDecimal.TEN, "USD"),
        status, NOW.minusSeconds(60), NOW.plusSeconds(60), null, null, null);
  }
}
