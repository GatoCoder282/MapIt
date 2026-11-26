package com.mapit.platform.domain.observability;

import org.jspecify.annotations.Nullable;

/**
 * Conteo que puede publicarse. Si está suprimido <strong>no conserva el número</strong>: así
 * ningún adaptador puede filtrarlo por descuido.
 */
public record GuardedCount(@Nullable Long value, boolean suppressed) {

  public GuardedCount {
    if (suppressed != (value == null)) {
      throw new IllegalArgumentException("Un conteo suprimido no lleva valor, y viceversa");
    }
  }

  public static GuardedCount of(long value) {
    return new GuardedCount(value, false);
  }

  public static GuardedCount hidden() {
    return new GuardedCount(null, true);
  }
}
