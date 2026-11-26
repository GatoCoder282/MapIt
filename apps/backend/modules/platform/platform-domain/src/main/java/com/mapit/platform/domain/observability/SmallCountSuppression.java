package com.mapit.platform.domain.observability;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Regla de privacidad P-2: un conteo entre 1 y {@code THRESHOLD - 1} se oculta, y en un
 * desglose nunca queda un único valor oculto que se pueda deducir restando del total.
 */
public final class SmallCountSuppression {

  public static final int THRESHOLD = 5;

  private SmallCountSuppression() {}

  public static GuardedCount guard(long count) {
    return isSmall(count) ? GuardedCount.hidden() : GuardedCount.of(count);
  }

  /** Desglose protegido: las partes y su suma. */
  public static <K> Breakdown<K> guard(Map<K, Long> counts) {
    Map<K, GuardedCount> parts = new LinkedHashMap<>();
    List<K> hidden = new ArrayList<>();
    counts.forEach(
        (key, count) -> {
          parts.put(key, guard(count));
          if (isSmall(count)) {
            hidden.add(key);
          }
        });
    long sum = counts.values().stream().mapToLong(Long::longValue).sum();
    GuardedCount total = guard(sum);
    if (hidden.size() == 1 && !total.suppressed()) {
      // Supresión complementaria: el siguiente más pequeño, o el total si no hay otro.
      K companion =
          counts.entrySet().stream()
              .filter(entry -> !hidden.contains(entry.getKey()) && entry.getValue() > 0)
              .min(Map.Entry.comparingByValue())
              .map(Map.Entry::getKey)
              .orElse(null);
      if (companion != null) {
        parts.put(companion, GuardedCount.hidden());
      } else {
        total = GuardedCount.hidden();
      }
    }
    return new Breakdown<>(parts, total);
  }

  private static boolean isSmall(long count) {
    return count > 0 && count < THRESHOLD;
  }

  public record Breakdown<K>(Map<K, GuardedCount> parts, GuardedCount total) {}
}
