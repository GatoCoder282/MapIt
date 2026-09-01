package com.mapit.spaces.application;

import java.util.UUID;

/** Indica que el elemento no existe dentro del tenant actual. */
public class DemoItemNotFoundException extends RuntimeException {

  public DemoItemNotFoundException(UUID id) {
    super("No existe el elemento de demostración " + id);
  }
}
