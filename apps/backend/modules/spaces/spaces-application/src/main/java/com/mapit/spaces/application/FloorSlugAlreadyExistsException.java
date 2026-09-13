package com.mapit.spaces.application;

public class FloorSlugAlreadyExistsException extends RuntimeException {
  public FloorSlugAlreadyExistsException(String slug) {
    super("El slug ya existe en este establecimiento: " + slug);
  }
}
