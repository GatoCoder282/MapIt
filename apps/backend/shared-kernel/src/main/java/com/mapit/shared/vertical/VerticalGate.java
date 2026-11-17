package com.mapit.shared.vertical;

import java.util.Objects;

import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/**
 * Pregunta a Unleash si una vertical está habilitada para un tenant.
 *
 * <p>La flag habilita, no configura: el resultado nunca cambia la vertical de un
 * establecimiento. Si Unleash no responde, {@link FeatureFlagPort} devuelve el valor por
 * defecto del catálogo ({@code true}), así que una caída del servidor de flags no deja sin
 * reservas a una vertical que ya opera.
 */
public final class VerticalGate {

  private final FeatureFlagPort flags;

  public VerticalGate(FeatureFlagPort flags) {
    this.flags = Objects.requireNonNull(flags, "flags no puede ser null");
  }

  public boolean isEnabled(Vertical vertical, TenantId tenantId) {
    return VerticalCatalog.of(vertical)
        .flag()
        .map(flag -> flags.isEnabledFor(flag, tenantId))
        .orElse(true);
  }

  /**
   * @throws VerticalDisabledException si la vertical está apagada para el tenant
   */
  public void require(Vertical vertical, TenantId tenantId) {
    if (!isEnabled(vertical, tenantId)) {
      throw new VerticalDisabledException(vertical);
    }
  }
}
