package com.mapit.payments.application;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.payments.domain.PaymentPolicy;

public record PaymentReadinessView(UUID establishmentId, boolean qrEnabled, @Nullable PaymentPolicy policy,
    boolean ready, List<Blocker> blockers) {
  public enum Blocker { POLICY_MISSING, POLICY_DISABLED, QR_MISSING, QR_DISABLED, MOCK_RUNTIME_DISABLED,
    METHOD_MISSING, METHOD_DISABLED, METHOD_SUPERSEDED, METHOD_CURRENCY_MISMATCH, METHOD_SCOPE_MISMATCH }
}
