package com.mapit.identity.domain;

import java.time.Instant;

/** Puerto para emitir un token de acceso a partir de una identidad ya verificada. */
public interface AccessTokenIssuer {
    IssuedAccessToken issue(AuthenticatedUser user);

    /** Emisión de login con hora confiable obtenida después de bloquear la fila. Sin fallback inseguro. */
    default IssuedAccessToken issue(AuthenticatedUser user, Instant observedAt) {
        throw new TokenIssuanceNotReady();
    }
}
