package com.mapit.identity.domain;

/** Puerto para emitir un token de acceso a partir de una identidad ya verificada. */
public interface AccessTokenIssuer {
    IssuedAccessToken issue(AuthenticatedUser user);
}
