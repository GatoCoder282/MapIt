package com.mapit.platform.infrastructure.flags;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;
import io.getunleash.event.UnleashSubscriber;

/** SDK network callbacks, rather than evaluations of its local cache, indicate availability. */
final class UnleashLoggingSubscriber implements UnleashSubscriber {
  private static final Logger LOG = LoggerFactory.getLogger(UnleashLoggingSubscriber.class);
  private final AtomicBoolean degraded = new AtomicBoolean();
  private final AtomicReference<Instant> lastSuccess = new AtomicReference<>();
  private final Clock clock;

  UnleashLoggingSubscriber() {
    this(Clock.systemUTC());
  }

  UnleashLoggingSubscriber(Clock clock) {
    this.clock = clock;
  }

  /** Solo la nueva protección contextual usa esta frescura; no altera el cache del SDK. */
  boolean available() {
    Instant success = lastSuccess.get();
    Instant now = clock.instant();
    return success != null && !now.isBefore(success) && now.isBefore(success.plus(Duration.ofSeconds(30)));
  }

  @Override
  public void onError(UnleashException exception) {
    failed();
  }

  @Override
  public void togglesFetched(ClientFeaturesResponse response) {
    if (response.getStatus() == ClientFeaturesResponse.Status.UNAVAILABLE) {
      failed();
    } else {
      lastSuccess.set(clock.instant());
      if (degraded.getAndSet(false)) {
        LOG.atInfo().addKeyValue("event", "integration.recovered").addKeyValue("integration", "unleash")
            .log("Feature flag transport recovered");
      }
    }
  }

  private void failed() {
    lastSuccess.set(null);
    if (!degraded.getAndSet(true)) {
      LOG.atWarn().addKeyValue("event", "integration.failed").addKeyValue("integration", "unleash")
          .log("Feature flag transport unavailable; cached values or defaults remain active");
    }
  }
}
