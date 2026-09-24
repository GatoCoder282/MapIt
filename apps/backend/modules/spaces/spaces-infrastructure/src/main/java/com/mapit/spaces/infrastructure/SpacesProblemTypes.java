package com.mapit.spaces.infrastructure;

/** Tipos RFC 9457 de los errores de la API del contexto spaces. */
public final class SpacesProblemTypes {

  public static final String BASE = "https://mapit.local/problems/";

  public static final String DEMO_ITEM_NOT_FOUND = BASE + "demo-item-not-found";
  public static final String ESTABLISHMENT_NOT_FOUND = BASE + "establishment-not-found";
  public static final String ESTABLISHMENT_SLUG_CONFLICT = BASE + "establishment-slug-conflict";
  public static final String ESTABLISHMENT_INVALID = BASE + "establishment-invalid";

  private SpacesProblemTypes() {}
}
