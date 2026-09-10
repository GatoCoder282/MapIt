package com.mapit.identity.domain;

import java.util.Optional;

/** Puerto para validar un token de acceso sin exponer la librería JWT al dominio. */
public interface AccessTokenVerifier {
    Optional<AuthenticatedPrincipal> verify(String token);
}
