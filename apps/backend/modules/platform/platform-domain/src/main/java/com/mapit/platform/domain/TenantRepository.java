package com.mapit.platform.domain;

import java.util.Optional;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de persistencia para tenants globales de la plataforma.
 *
 * <p>La tabla {@code tenant} es global (sin {@code tenant_id} ni RLS, ver ADR-0004):
 * estas operaciones son de plataforma y solo las invoca el caso de uso protegido
 * por SUPER_ADMIN. No es una vía genérica de acceso cross-tenant.
 */
public interface TenantRepository {

  /** Indica si el slug ya fue registrado. */
  boolean existsBySlug(String slug);

  /** Persiste y devuelve el tenant registrado. */
  Tenant save(Tenant tenant);

  /** Busca por identificador; vacío si no existe. */
  Optional<Tenant> findById(TenantId id);

  /**
   * Listado paginado con filtros opcionales. {@code search} matchea nombre o slug
   * de forma parcial e insensible a mayúsculas. Orden estable por fecha de registro
   * descendente.
   */
  TenantPage search(@Nullable String search, @Nullable TenantStatus status, int page, int size);
}
