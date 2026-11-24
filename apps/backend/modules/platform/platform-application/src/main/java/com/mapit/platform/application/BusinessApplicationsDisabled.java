package com.mapit.platform.application;

/** La recepción de solicitudes nuevas está apagada por la flag de HU-1.05. */
public final class BusinessApplicationsDisabled extends RuntimeException {
  public BusinessApplicationsDisabled() {
    super("La incorporación de negocios no está disponible en este momento");
  }
}
