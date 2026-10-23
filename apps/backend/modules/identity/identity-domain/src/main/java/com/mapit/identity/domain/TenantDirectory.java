package com.mapit.identity.domain;

import java.util.Optional;

import com.mapit.shared.tenant.TenantId;

/** Lectura del catálogo de tenants para resolver slugs (tabla global). */
public interface TenantDirectory {

  Optional<TenantId> findIdBySlug(String slug);
}
