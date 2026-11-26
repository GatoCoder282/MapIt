package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;
import io.getunleash.event.FeatureSet;

class MyAccountFlagAvailabilityTest {
  private final AtomicLong nanos = new AtomicLong(1);
  private final MyAccountFlagAvailability availability = new MyAccountFlagAvailability(nanos::get);

  @Test
  void requiresNetworkConfirmationAndAppliedSnapshotNotRestoredBackup() {
    assertThat(availability.isFresh()).isFalse();
    availability.featuresBackupRestored(mock(FeatureSet.class));
    assertThat(availability.isFresh()).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    assertThat(availability.isFresh()).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.updated("{}"));
    assertThat(availability.isFresh()).isFalse();
    availability.featuresBackedUp(mock(FeatureSet.class));
    assertThat(availability.isFresh()).isTrue();
  }

  @Test
  void expiresAtThirtySecondsAndNotChangedRenewsFreshness() {
    confirmSnapshot();
    nanos.addAndGet(MyAccountFlagAvailability.MAX_AGE_NANOS - 1);
    assertThat(availability.isFresh()).isTrue();
    nanos.incrementAndGet();
    assertThat(availability.isFresh()).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    assertThat(availability.isFresh()).isTrue();
  }

  @Test
  void failsClosedOnTransportOrSdkErrorAndRecoversOnlyWithLiveConfirmation() {
    confirmSnapshot();
    availability.togglesFetched(ClientFeaturesResponse.unavailable(503, Optional.empty()));
    assertThat(availability.isFresh()).isFalse();
    availability.featuresBackedUp(mock(FeatureSet.class));
    assertThat(availability.isFresh()).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    assertThat(availability.isFresh()).isTrue();
    availability.togglesFetched(ClientFeaturesResponse.updated("{}"));
    availability.onError(mock(UnleashException.class));
    availability.featuresBackedUp(mock(FeatureSet.class));
    assertThat(availability.isFresh()).isFalse();
    availability.togglesFetched(ClientFeaturesResponse.notChanged());
    assertThat(availability.isFresh()).isFalse();
    confirmSnapshot();
    assertThat(availability.isFresh()).isTrue();
  }

  private void confirmSnapshot() {
    availability.togglesFetched(ClientFeaturesResponse.updated("{}"));
    availability.featuresBackedUp(mock(FeatureSet.class));
  }
}
