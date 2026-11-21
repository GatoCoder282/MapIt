package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.tenant.TenantId;

import io.getunleash.Unleash;
import io.getunleash.UnleashContext;
import io.getunleash.event.ClientFeaturesResponse;
import io.getunleash.event.FeatureSet;

class MyAccountFlagAdapterTest {
  private static final FeatureFlag FLAG = FeatureFlag.MAPIT_S6_MY_ACCOUNT;
  private final Unleash unleash = mock(Unleash.class);
  private final AtomicLong nanos = new AtomicLong(1);
  private final MyAccountFlagAvailability availability = new MyAccountFlagAvailability(nanos::get);
  private final UnleashFeatureFlagAdapter adapter = new UnleashFeatureFlagAdapter(unleash, availability);

  @Test
  void refusesMissingProviderTenantOrWarmCacheWithoutLiveConfirmation() {
    assertThat(adapter.isEnabled(FLAG)).isFalse();
    assertThat(adapter.isEnabled(FLAG, true)).isFalse();
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("tenant-a"))).isFalse();
    assertThat(new DisabledFeatureFlagAdapter().isEnabled(FLAG, true)).isFalse();
    verify(unleash, never()).isEnabled(eq(FLAG.clave()), any(UnleashContext.class), anyBoolean());
  }

  @Test
  void evaluatesEachTenantWithoutSharingDecisionsAndFailsClosedForMissingFlag() {
    confirmSnapshot();
    when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false)))
        .thenAnswer(call -> "tenant-a".equals(((UnleashContext) call.getArgument(1)).getProperties().get("tenantId")));
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("tenant-a"))).isTrue();
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("tenant-b"))).isFalse();
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("platform"))).isFalse();
    when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenReturn(false);
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("tenant-a"))).isFalse();
  }

  @Test
  void rollbackFailureExpiryAndRecoveryDoNotTrustAnOldCachedOn() {
    var tenant = TenantId.of("tenant-a");
    when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenReturn(true);
    confirmSnapshot();
    assertThat(adapter.isEnabledFor(FLAG, tenant)).isTrue();
    availability.togglesFetched(ClientFeaturesResponse.unavailable(503, Optional.empty()));
    assertThat(adapter.isEnabledFor(FLAG, tenant)).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    assertThat(adapter.isEnabledFor(FLAG, tenant)).isTrue();
    nanos.addAndGet(MyAccountFlagAvailability.MAX_AGE_NANOS);
    assertThat(adapter.isEnabledFor(FLAG, tenant)).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenReturn(false);
    assertThat(adapter.isEnabledFor(FLAG, tenant)).isFalse();
  }

  @Test
  void sdkExceptionDoesNotEnableAndOtherFlagsKeepTheirExistingEvaluation() {
    confirmSnapshot();
    when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenThrow(new IllegalStateException("private"));
    assertThat(adapter.isEnabledFor(FLAG, TenantId.of("tenant-a"))).isFalse();
    var other = FeatureFlag.REALTIME_WEBSOCKET;
    availability.togglesFetched(ClientFeaturesResponse.unavailable(503, Optional.empty()));
    when(unleash.isEnabled(other.clave(), true)).thenReturn(true);
    when(unleash.isEnabled(eq(other.clave()), any(UnleashContext.class), eq(other.valorPorDefecto()))).thenReturn(true);
    assertThat(adapter.isEnabled(other)).isTrue();
    assertThat(adapter.isEnabledFor(other, TenantId.of("tenant-b"))).isTrue();
    assertThat(new DisabledFeatureFlagAdapter().isEnabled(other, true)).isTrue();
  }

  private void confirmSnapshot() {
    availability.togglesFetched(ClientFeaturesResponse.updated("{}"));
    availability.featuresBackedUp(mock(FeatureSet.class));
  }
}
