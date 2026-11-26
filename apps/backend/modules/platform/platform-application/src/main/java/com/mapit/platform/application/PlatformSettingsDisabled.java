package com.mapit.platform.application;

/** La sección está apagada por {@code mapit.s6.platform-settings}. */
public final class PlatformSettingsDisabled extends RuntimeException {

  public PlatformSettingsDisabled() {
    super("La configuración de plataforma no está habilitada");
  }
}
