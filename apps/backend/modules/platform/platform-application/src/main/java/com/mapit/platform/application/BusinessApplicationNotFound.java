package com.mapit.platform.application;

public final class BusinessApplicationNotFound extends RuntimeException {
  public BusinessApplicationNotFound() {
    super("Solicitud no encontrada");
  }
}
