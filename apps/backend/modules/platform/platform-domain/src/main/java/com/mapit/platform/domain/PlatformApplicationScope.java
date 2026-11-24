package com.mapit.platform.domain;

/** Fija el tenant técnico dentro de la transacción que consulta solicitudes. */
public interface PlatformApplicationScope {
  void enter();
}
