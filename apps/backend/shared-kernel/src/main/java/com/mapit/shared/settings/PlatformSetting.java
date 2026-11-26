package com.mapit.shared.settings;

import java.util.Arrays;
import java.util.Optional;

/**
 * Allowlist de parámetros globales editables (HU-7.07, spec «Inventario»).
 *
 * <p>Es un enum para que el conjunto sea cerrado: la API no puede crear claves. El valor por
 * defecto lo manda el despliegue ({@link #property()}); {@link #fallback()} cubre su ausencia.
 */
public enum PlatformSetting {
  CUSTOMER_HISTORY_LINK_TTL(
      "customer-history.link-ttl-minutes", "mapit.customer-history.link-ttl-minutes", 15, 5, 60),
  CUSTOMER_HISTORY_SESSION_TTL(
      "customer-history.session-ttl-minutes",
      "mapit.customer-history.session-ttl-minutes",
      30,
      10,
      120);

  private final String key;
  private final String property;
  private final int fallback;
  private final int min;
  private final int max;

  PlatformSetting(String key, String property, int fallback, int min, int max) {
    this.key = key;
    this.property = property;
    this.fallback = fallback;
    this.min = min;
    this.max = max;
  }

  public static Optional<PlatformSetting> of(String key) {
    return Arrays.stream(values()).filter(setting -> setting.key.equals(key)).findFirst();
  }

  public String key() {
    return key;
  }

  public String property() {
    return property;
  }

  public int fallback() {
    return fallback;
  }

  public int min() {
    return min;
  }

  public int max() {
    return max;
  }

  public boolean accepts(int value) {
    return value >= min && value <= max;
  }
}
