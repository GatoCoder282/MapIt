package com.mapit.payments.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

public class PaymentPolicyService {
  private final PaymentConfigurationRepository configuration;
  private final PaymentMethodRepository methods;
  private final MockQrConfigurationService mockQrConfigurations;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final Clock clock;

  public PaymentPolicyService(PaymentConfigurationRepository configuration, PaymentMethodRepository methods,
      MockQrConfigurationService mockQrConfigurations, TenantContext tenants, ActorContext actors, Clock clock) {
    this.configuration = configuration; this.methods = methods; this.tenants = tenants; this.actors = actors; this.clock = clock;
    this.mockQrConfigurations = mockQrConfigurations;
  }

  @Transactional(readOnly = true)
  public Optional<PaymentPolicy> get(UUID establishmentId) {
    TenantId tenant = tenants.require();
    requireEstablishment(tenant, establishmentId);
    return configuration.policy(tenant, establishmentId);
  }

  @Transactional
  public PaymentPolicy save(UUID establishmentId, boolean enabled, String currency, BigDecimal depositAmount,
      @Nullable BigDecimal totalAmount, int paymentWindowMinutes) {
    TenantId tenant = tenants.require();
    requireEstablishment(tenant, establishmentId);
    if (!configuration.lockEstablishment(tenant, establishmentId)) throw new NotFound();
    UUID actor = actors.requireUserId();
    Money deposit = new Money(depositAmount, currency);
    Money total = totalAmount == null ? null : new Money(totalAmount, currency);
    PaymentPolicy policy = new PaymentPolicy(UUID.randomUUID(), tenant, establishmentId, enabled,
        deposit, total, paymentWindowMinutes, clock.instant(), actor);
    PaymentPolicy saved = configuration.savePolicy(policy);
    mockQrConfigurations.synchronizeAfterPolicySave(tenant, establishmentId, actor, policy.updatedAt());
    return saved;
  }

  private void requireEstablishment(TenantId tenant, UUID id) {
    if (!methods.establishmentExists(tenant, id)) throw new NotFound();
  }

  public static class NotFound extends RuntimeException {
    public NotFound() { super("Establecimiento no encontrado"); }
  }
}
