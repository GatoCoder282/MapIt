package com.mapit.identity.domain;

import java.util.Optional;

/** Consulta previa al login: el slug selecciona empresa, pero no concede autorización. */
public interface UserCredentialsRepository {
    Optional<UserCredentials> findByTenantSlugAndEmail(String tenantSlug, String email);
}
