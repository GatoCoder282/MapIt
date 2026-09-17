package com.mapit.identity.infrastructure;

/** Tipos RFC 9457 de los errores del endpoint de login. */
final class LoginProblemTypes {

  static final String BASE = "https://mapit.local/problems/";

  static final String INVALID_CREDENTIALS = BASE + "invalid-credentials";
  static final String INVALID_REQUEST = BASE + "invalid-request";

  private LoginProblemTypes() {}
}
