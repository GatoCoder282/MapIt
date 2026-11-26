package com.mapit.platform.infrastructure.flags;

import java.time.Duration;
import java.util.function.LongSupplier;

import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;
import io.getunleash.event.FeatureSet;
import io.getunleash.event.UnleashSubscriber;

/** Acota solo Mi cuenta; no sustituye evaluación de estrategias ni autorización. */
final class MyAccountFlagAvailability implements UnleashSubscriber {
  static final long MAX_AGE_NANOS = Duration.ofSeconds(30).toNanos();
  private final LongSupplier nanoTime;
  private final UnleashLoggingSubscriber logging;
  private volatile Snapshot snapshot = new Snapshot(false, false, false, 0);

  MyAccountFlagAvailability() {
    this(System::nanoTime);
  }

  MyAccountFlagAvailability(LongSupplier nanoTime) {
    this(nanoTime, new UnleashLoggingSubscriber());
  }

  MyAccountFlagAvailability(LongSupplier nanoTime, UnleashLoggingSubscriber logging) {
    this.nanoTime = nanoTime;
    this.logging = logging;
  }

  boolean isFresh() {
    var current = snapshot;
    long age = nanoTime.getAsLong() - current.observedAt();
    return current.available() && age >= 0 && age < MAX_AGE_NANOS;
  }

  boolean unavailable() {
    return logging.unavailable();
  }

  @Override
  public synchronized void togglesFetched(ClientFeaturesResponse response) {
    logging.togglesFetched(response);
    snapshot = switch (response.getStatus()) {
      // El SDK todavía NO ha aplicado el nuevo estado al emitir CHANGED.
          case CHANGED -> new Snapshot(false, true, false, 0);
          case NOT_CHANGED -> new Snapshot(snapshot.applied(), false, snapshot.applied(), nanoTime.getAsLong());
          case UNAVAILABLE -> new Snapshot(false, false, snapshot.applied(), 0);
    };
  }

  @Override
  public synchronized void featuresBackedUp(FeatureSet features) {
    // En 11.0.2 este callback sucede después de engine.takeState. Un backup
    // restaurado al iniciar no pasa por aquí ni acredita conexión al servidor.
    if (snapshot.awaitingSnapshot()) {
      snapshot = new Snapshot(true, false, true, nanoTime.getAsLong());
    }
  }

  @Override
  public synchronized void onError(UnleashException exception) {
    snapshot = new Snapshot(false, false, snapshot.applied(), 0);
    logging.onError(exception);
  }

  private record Snapshot(boolean available, boolean awaitingSnapshot, boolean applied, long observedAt) {}
}
