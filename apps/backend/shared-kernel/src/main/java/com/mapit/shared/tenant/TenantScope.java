package com.mapit.shared.tenant;

/**
 * Constantes del aislamiento multi-tenant por RLS (ADR-0004).
 *
 * <p>La clave de configuración de sesión y el SQL para fijarla estaban copiados
 * en cada adaptador junto al texto literal. Una errata en uno de ellos apagaría
 * la política en silencio; por eso ahora hay una sola fuente.
 */
public final class TenantScope {

  /** Clave de sesión PostgreSQL que leen las políticas RLS ({@code current_tenant_id()}). */
  public static final String SESSION_KEY = "app.tenant_id";

  /**
   * Fragmento SQL que fija el tenant con alcance LOCAL a la transacción
   * ({@code set_config(..., is_local = true)}): una conexión reutilizada del pool
   * nunca hereda el tenant de la transacción anterior.
   */
  public static final String SET_LOCAL_SQL = "select set_config('" + SESSION_KEY + "', ?, true)";

  private TenantScope() {}
}
