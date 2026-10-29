package com.mapit.reservations.application.history;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/** Límite local a una instancia. Multi-réplica requiere proxy o almacén compartido. */
@Component
public class HistoryIpLimiter {
  private final ConcurrentHashMap<String, ArrayDeque<Instant>> attempts = new ConcurrentHashMap<>();
  private final CustomerHistoryPolicy policy;
  private final Clock clock;

  public HistoryIpLimiter(CustomerHistoryPolicy policy, Clock clock) {
    this.policy = policy;
    this.clock = clock;
  }

  public boolean allow(String address) {
    Instant now = clock.instant();
    if (attempts.size() >= 10_000) {
      attempts.entrySet().removeIf(entry -> {
        synchronized (entry.getValue()) {
          return entry.getValue().isEmpty() || entry.getValue().peekLast().isBefore(now.minus(policy.windowMinutes(), ChronoUnit.MINUTES));
        }
      });
      if (attempts.size() >= 10_000 && !attempts.containsKey(address)) return false;
    }
    // La IP procede exclusivamente de la conexión; nunca de X-Forwarded-For sin proxy de confianza.
    ArrayDeque<Instant> bucket = attempts.computeIfAbsent(address, key -> new ArrayDeque<>());
    synchronized (bucket) {
      Instant since = now.minus(policy.windowMinutes(), ChronoUnit.MINUTES);
      while (!bucket.isEmpty() && bucket.peekFirst().isBefore(since)) bucket.removeFirst();
      if (bucket.size() >= policy.ipLimit()) return false;
      bucket.addLast(now);
    }
    return true;
  }
}
