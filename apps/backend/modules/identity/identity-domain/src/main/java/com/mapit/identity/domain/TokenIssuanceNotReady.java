package com.mapit.identity.domain;

/** Sin token: esperar un segundo seguro de iat o recuperar alineación de relojes. */
public final class TokenIssuanceNotReady extends RuntimeException {
    public TokenIssuanceNotReady() { super("No se pudo emitir una sesión segura. Intente nuevamente."); }
}
