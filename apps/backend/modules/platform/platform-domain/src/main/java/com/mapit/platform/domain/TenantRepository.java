package com.mapit.platform.domain;

/** Puerto de persistencia para tenants globales de la plataforma. */
public interface TenantRepository {

  /** Indica si el slug ya fue registrado. */
  boolean existsBySlug(String slug);

  /** Persiste y devuelve el tenant registrado. */
  Tenant save(Tenant tenant);
}
