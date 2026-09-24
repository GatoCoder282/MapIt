package com.mapit.spaces.application.floor;

public class FloorLevelAlreadyExistsException extends RuntimeException {
  public FloorLevelAlreadyExistsException(int level) {
    super("El nivel ya existe en este establecimiento: " + level);
  }
}
