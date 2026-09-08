package com.mapit.platform.application;

/** Indica que el slug solicitado ya pertenece a otro tenant. */
public class TenantSlugAlreadyExistsException extends RuntimeException {

  public TenantSlugAlreadyExistsException(String slug) {
    super("El slug ya está registrado: " + slug);
  }
}
