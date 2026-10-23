package com.mapit.spaces.application.floor;

import java.util.UUID;

public class FloorHasActiveSectorsException extends RuntimeException {
  public FloorHasActiveSectorsException(UUID floorId) {
    super("El piso tiene sectores activos. Elimine primero los sectores.");
  }
}
