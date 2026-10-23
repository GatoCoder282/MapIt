package com.mapit.platform.infrastructure.flags;

import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;
import io.getunleash.event.UnleashSubscriber;

/** SDK network callbacks, rather than evaluations of its local cache, indicate availability. */
final class UnleashLoggingSubscriber implements UnleashSubscriber {
  private static final Logger LOG = LoggerFactory.getLogger(UnleashLoggingSubscriber.class);
  private final AtomicBoolean degraded = new AtomicBoolean();

  @Override
  public void onError(UnleashException exception) {
    failed();
  }

  @Override
  public void togglesFetched(ClientFeaturesResponse response) {
    if (response.getStatus() == ClientFeaturesResponse.Status.UNAVAILABLE) {
      failed();
    } else if (degraded.getAndSet(false)) {
      LOG.atInfo().addKeyValue("event", "integration.recovered").addKeyValue("integration", "unleash")
          .log("Feature flag transport recovered");
    }
  }

  private void failed() {
    if (!degraded.getAndSet(true)) {
      LOG.atWarn().addKeyValue("event", "integration.failed").addKeyValue("integration", "unleash")
          .log("Feature flag transport unavailable; cached values or defaults remain active");
    }
  }
}
