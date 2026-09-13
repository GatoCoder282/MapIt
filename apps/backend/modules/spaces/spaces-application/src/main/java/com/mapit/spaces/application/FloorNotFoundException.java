package com.mapit.spaces.application;

import java.util.UUID;

public class FloorNotFoundException extends RuntimeException {
  public FloorNotFoundException(UUID id) {
    super("Piso no encontrado: " + id);
  }
}
