package com.mapit.platform.application;

/** La sección está apagada por {@code mapit.s6.tenant-observability}. */
public final class TenantObservabilityDisabled extends RuntimeException {

  public TenantObservabilityDisabled() {
    super("La observabilidad de empresas no está habilitada");
  }
}
