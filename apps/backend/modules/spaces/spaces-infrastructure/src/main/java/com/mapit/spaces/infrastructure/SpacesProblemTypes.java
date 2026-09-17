package com.mapit.spaces.infrastructure;

/** Tipos RFC 9457 de los errores de la API del contexto spaces. */
final class SpacesProblemTypes {

  private static final String BASE = "https://mapit.local/problems/";

  static final String DEMO_ITEM_NOT_FOUND = BASE + "demo-item-not-found";
  static final String ESTABLISHMENT_NOT_FOUND = BASE + "establishment-not-found";
  static final String ESTABLISHMENT_SLUG_CONFLICT = BASE + "establishment-slug-conflict";
  static final String ESTABLISHMENT_INVALID = BASE + "establishment-invalid";

  private SpacesProblemTypes() {}
}
