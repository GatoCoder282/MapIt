package com.mapit.spaces.application;

import java.util.UUID;

/** Indica que el sector no existe dentro del tenant actual. */
public class SectorNotFoundException extends RuntimeException {

  public SectorNotFoundException(UUID id) {
    super("No existe el sector " + id);
  }
}