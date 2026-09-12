package com.mapit.spaces.application;

/**
 * Indica que otro establecimiento vivo del mismo tenant ya usa ese slug.
 *
 * <p>La unicidad es por tenant y solo entre filas vivas: dos empresas distintas pueden
 * repetir el slug, y el de un establecimiento dado de baja queda libre.
 */
public class EstablishmentSlugAlreadyExistsException extends RuntimeException {

  public EstablishmentSlugAlreadyExistsException(String slug) {
    super("Ya existe un establecimiento con el slug '" + slug + "'");
  }
}
