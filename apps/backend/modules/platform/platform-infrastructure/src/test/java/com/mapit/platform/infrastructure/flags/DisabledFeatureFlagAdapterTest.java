package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

class DisabledFeatureFlagAdapterTest {

  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner().withUserConfiguration(DisabledFeatureFlagAdapter.class);

  @Test
  void registersOnlyWhenUnleashIsDisabled() {
    contextRunner
        .withPropertyValues("mapit.unleash.enabled=false")
        .run(context -> assertThat(context).hasSingleBean(FeatureFlagPort.class));

    contextRunner
        .withPropertyValues("mapit.unleash.enabled=true")
        .run(context -> assertThat(context).doesNotHaveBean(FeatureFlagPort.class));
  }

  @Test
  void usesCatalogOrExplicitDefaults() {
    var adapter = new DisabledFeatureFlagAdapter();

    assertThat(adapter.isEnabled(FeatureFlag.REALTIME_WEBSOCKET)).isTrue();
    assertThat(adapter.isEnabled(FeatureFlag.PAYMENTS_QR)).isFalse();
    assertThat(adapter.isEnabled(FeatureFlag.PAYMENTS_QR, true)).isTrue();
  }
}
