package com.mapit.platform.infrastructure.flags;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Uses the catalog defaults when the external Unleash provider is disabled. */
@Component
@ConditionalOnProperty(prefix = "mapit.unleash", name = "enabled", havingValue = "false")
public final class DisabledFeatureFlagAdapter implements FeatureFlagPort {

  @Override
  public boolean isEnabled(FeatureFlag flag) {
    return flag.valorPorDefecto();
  }

  @Override
  public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
    return valorPorDefecto;
  }
}
