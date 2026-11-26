package com.mapit.platform.domain;

/** Estado de las dependencias que la plataforma puede comprobar sin exponer su configuración. */
public interface PlatformServiceStatus {

  boolean databaseAvailable();

  FlagProvider flagProvider();

  /** Estado del proveedor de feature flags. */
  enum FlagProvider {
    AVAILABLE,
    UNAVAILABLE,
    DISABLED
  }
}
