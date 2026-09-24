package com.mapit.spaces.application;

import java.util.UUID;

/** Indica que el elemento espacial no existe dentro del tenant/sector del contexto. */
public class SpaceElementNotFoundException extends RuntimeException {

  public SpaceElementNotFoundException(UUID id) {
    super("No existe el elemento espacial " + id);
  }
}
