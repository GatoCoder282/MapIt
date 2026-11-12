package com.mapit.identity.domain;

import java.util.Optional;

/** Revalida contra la BD una identidad obtenida de un JWT criptográficamente válido. */
public interface CurrentStaffIdentity {
  Optional<AuthenticatedPrincipal> resolve(AuthenticatedPrincipal signed);
}
