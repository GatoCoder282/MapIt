package com.mapit.spaces.application;

/** Indica que otro sector vivo del mismo tenant ya usa ese slug. */
public class SectorSlugAlreadyExistsException extends RuntimeException {

  public SectorSlugAlreadyExistsException(String slug) {
    super("Ya existe un sector con el slug '" + slug + "'");
  }
}
