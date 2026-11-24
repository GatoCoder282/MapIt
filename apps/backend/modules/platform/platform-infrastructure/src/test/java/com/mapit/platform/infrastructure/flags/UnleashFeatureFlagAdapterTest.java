package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;

import org.junit.jupiter.api.Test;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.tenant.TenantId;

import io.getunleash.Unleash;
import io.getunleash.UnleashContext;
import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;

class UnleashFeatureFlagAdapterTest {
  @Test
  void solicitudes_caen_a_off_tras_perder_unleash_y_vuelven_al_recuperarse() {
    Unleash unleash = mock(Unleash.class);
    when(unleash.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS.clave(), false)).thenReturn(true);
    when(unleash.isEnabled(org.mockito.ArgumentMatchers.eq(FeatureFlag.BUSINESS_APPLICATIONS.clave()),
        org.mockito.ArgumentMatchers.any(UnleashContext.class), org.mockito.ArgumentMatchers.eq(false)))
        .thenReturn(true);
    var availability = new MyAccountFlagAvailability();
    var adapter = new UnleashFeatureFlagAdapter(unleash, availability);
    TenantId tenant = TenantId.of("platform");

    assertThat(adapter.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS)).isTrue();
    assertThat(adapter.isEnabledFor(FeatureFlag.BUSINESS_APPLICATIONS, tenant)).isTrue();
    availability.onError(mock(UnleashException.class));
    assertThat(adapter.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS)).isFalse();
    assertThat(adapter.isEnabledFor(FeatureFlag.BUSINESS_APPLICATIONS, tenant)).isFalse();

    var recovered = mock(ClientFeaturesResponse.class);
    when(recovered.getStatus()).thenReturn(Arrays.stream(ClientFeaturesResponse.Status.values())
        .filter(status -> status != ClientFeaturesResponse.Status.UNAVAILABLE).findFirst().orElseThrow());
    availability.togglesFetched(recovered);
    assertThat(adapter.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS)).isTrue();
  }
}
