package com.mapit.platform.application;

/** El tenant solicitado no existe. */
public class TenantNotFoundException extends RuntimeException {

  public TenantNotFoundException(String id) {
    super("No existe un tenant con id " + id);
  }
}
