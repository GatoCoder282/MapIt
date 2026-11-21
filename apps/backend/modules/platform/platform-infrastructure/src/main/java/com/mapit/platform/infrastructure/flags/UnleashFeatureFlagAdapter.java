package com.mapit.platform.infrastructure.flags;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagContext;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

import io.getunleash.Unleash;
import io.getunleash.UnleashContext;

/** Adapta Unleash al puerto puro usado por el resto del backend. */
@Component
@ConditionalOnProperty(
    prefix = "mapit.unleash", name = "enabled", havingValue = "true", matchIfMissing = true)
public final class UnleashFeatureFlagAdapter implements FeatureFlagPort {

  /** Propiedad de contexto que leen las estrategias por tenant de los PERMISSION toggles. */
  static final String TENANT_PROPERTY = "tenantId";

  private final Unleash unleash;
  private final UnleashLoggingSubscriber transport;

  public UnleashFeatureFlagAdapter(Unleash unleash, UnleashLoggingSubscriber transport) {
    this.unleash = unleash;
    this.transport = transport;
  }

  @Override
  public boolean isEnabled(FeatureFlag flag) {
    return isEnabled(flag, flag.valorPorDefecto());
  }

  @Override
  public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
    if (flag == FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER) return false;
    return unleash.isEnabled(flag.clave(), valorPorDefecto);
  }

  @Override
  public boolean isEnabledFor(FeatureFlag flag, TenantId tenantId) {
    if (flag == FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER) return false;
    UnleashContext context =
        UnleashContext.builder().addProperty(TENANT_PROPERTY, tenantId.value()).build();
    return unleash.isEnabled(flag.clave(), context, flag.valorPorDefecto());
  }

  @Override
  public boolean isEnabledFor(FeatureFlag flag, FeatureFlagContext context) {
    if (flag != FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER || context == null || !transport.available()) return false;
    try {
      UnleashContext scoped = UnleashContext.builder()
          .userId(context.userId().toString()).sessionId(context.sessionId())
          .addProperty(TENANT_PROPERTY, context.tenantId().value()).build();
      return unleash.isEnabled(flag.clave(), scoped, false) && transport.available();
    } catch (RuntimeException unavailable) {
      return false;
    }
  }
}
