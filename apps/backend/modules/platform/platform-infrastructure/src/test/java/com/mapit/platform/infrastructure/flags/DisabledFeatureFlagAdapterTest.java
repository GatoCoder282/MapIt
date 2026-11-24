package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

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
    assertThat(adapter.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS)).isFalse();
  }

  @Test
  void myAccountIsDisabledWithoutUnleashForBusinessAndPlatformTenants() {
    var flag = FeatureFlag.MAPIT_S6_MY_ACCOUNT;
    var adapter = new DisabledFeatureFlagAdapter();

    assertThat(flag.clave()).isEqualTo("mapit.s6.my-account");
    assertThat(flag.tipo()).isEqualTo(FeatureFlag.Tipo.RELEASE);
    assertThat(flag.valorPorDefecto()).isFalse();
    assertThat(adapter.isEnabled(flag)).isFalse();
    assertThat(adapter.isEnabledFor(flag, TenantId.of("demo"))).isFalse();
    assertThat(adapter.isEnabledFor(flag, TenantId.of("platform"))).isFalse();
  }
}
