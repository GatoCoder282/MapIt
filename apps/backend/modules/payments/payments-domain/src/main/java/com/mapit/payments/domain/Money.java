package com.mapit.payments.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Objects;

/** Importe exacto según la unidad menor ISO de la moneda, sin redondeos implícitos. */
public record Money(BigDecimal amount, String currency) {
  public Money {
    Objects.requireNonNull(amount, "amount");
    Currency unit = Currency.getInstance(currency);
    if (unit.getDefaultFractionDigits() < 0 || amount.signum() <= 0) {
      throw new IllegalArgumentException("Moneda o importe de cobro inválido");
    }
    amount = amount.setScale(unit.getDefaultFractionDigits(), RoundingMode.UNNECESSARY);
    if (amount.precision() - amount.scale() > 18 || amount.scale() > 6) {
      throw new IllegalArgumentException("Importe fuera de rango");
    }
  }
}
