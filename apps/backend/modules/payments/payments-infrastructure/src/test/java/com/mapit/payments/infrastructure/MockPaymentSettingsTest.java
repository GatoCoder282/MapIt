package com.mapit.payments.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class MockPaymentSettingsTest {
  @Test
  void opt_in_exige_dev_test_sin_perfiles_productivos() {
    var env = new MockEnvironment().withProperty("mapit.payments.mock.enabled", "true");
    env.setActiveProfiles("test");
    assertThat(new MockPaymentSettings(env, Clock.systemUTC()).allowed()).isTrue();
    env.setActiveProfiles("test", "prod");
    var mixed = new MockPaymentSettings(env, Clock.systemUTC());
    assertThat(mixed.allowed()).isFalse();
    assertThatThrownBy(mixed::authenticator).isInstanceOf(MockPaymentSettings.Disabled.class);
    env.setActiveProfiles("test");
    env.setProperty("mapit.payments.mock.enabled", "false");
    assertThat(new MockPaymentSettings(env, Clock.systemUTC()).allowed()).isFalse();
    env.setProperty("mapit.payments.mock.enabled", "true");
    for (String[] profiles : new String[][]{{}, {"prod"}, {"dev", "prod"}, {"dev", "staging"}}) {
      env.setActiveProfiles(profiles);
      assertThat(new MockPaymentSettings(env, Clock.systemUTC()).allowed()).isFalse();
    }
    env.setActiveProfiles("dev", "test");
    assertThat(new MockPaymentSettings(env, Clock.systemUTC()).allowed()).isTrue();
  }

  @Test
  void secretos_cortos_no_habilitan_un_mock_de_firma_debil() {
    var env = new MockEnvironment().withProperty("mapit.payments.mock.enabled", "true")
        .withProperty("mapit.payments.mock.webhook-secret", "short");
    env.setActiveProfiles("dev");
    assertThatThrownBy(() -> new MockPaymentSettings(env, Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
  }
}
