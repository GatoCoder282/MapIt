package com.mapit.platform.application;

/** La clave no pertenece a la allowlist. */
public final class UnknownPlatformSetting extends RuntimeException {

  public UnknownPlatformSetting(String key) {
    super("Parámetro desconocido: " + key);
  }
}
