package com.mapit.platform.application;

/** El valor efectivo cambió desde que el cliente lo leyó (RN-6). */
public final class PlatformSettingConflict extends RuntimeException {

  public PlatformSettingConflict() {
    super("El valor cambió desde que se cargó. Recarga antes de volver a intentarlo");
  }
}
