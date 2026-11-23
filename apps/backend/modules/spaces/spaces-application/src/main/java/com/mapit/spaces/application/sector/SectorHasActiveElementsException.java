package com.mapit.spaces.application.sector;

public class SectorHasActiveElementsException extends RuntimeException {
  public SectorHasActiveElementsException() {
    super("El sector contiene elementos activos. Retíralos antes de eliminarlo.");
  }
}
