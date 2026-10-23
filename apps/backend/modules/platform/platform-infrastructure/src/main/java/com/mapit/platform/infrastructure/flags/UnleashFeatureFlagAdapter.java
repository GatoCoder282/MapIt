package com.mapit.platform.infrastructure.flags;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

import io.getunleash.Unleash;

/** Adapta Unleash al puerto puro usado por el resto del backend. */
@Component
@ConditionalOnProperty(
    prefix = "mapit.unleash", name = "enabled", havingValue = "true", matchIfMissing = true)
public final class UnleashFeatureFlagAdapter implements FeatureFlagPort {

  private final Unleash unleash;

  public UnleashFeatureFlagAdapter(Unleash unleash) {
    this.unleash = unleash;
  }

  @Override
  public boolean isEnabled(FeatureFlag flag) {
    return isEnabled(flag, flag.valorPorDefecto());
  }

  @Override
  public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
    return unleash.isEnabled(flag.clave(), valorPorDefecto);
  }
}
