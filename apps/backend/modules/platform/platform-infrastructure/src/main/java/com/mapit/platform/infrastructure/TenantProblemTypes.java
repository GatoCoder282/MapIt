package com.mapit.platform.infrastructure;

/** Tipos RFC 9457 de los errores de la API de tenants. Una sola fuente por módulo. */
final class TenantProblemTypes {

  static final String BASE = "https://mapit.local/problems/";

  static final String TENANT_NOT_FOUND = BASE + "tenant-not-found";
  static final String INVALID_REQUEST = BASE + "invalid-request";
  static final String SLUG_CONFLICT = BASE + "tenant-slug-conflict";
  static final String CONFIRMATION_UNAVAILABLE = BASE + "tenant-confirmation-unavailable";

  private TenantProblemTypes() {}
}
