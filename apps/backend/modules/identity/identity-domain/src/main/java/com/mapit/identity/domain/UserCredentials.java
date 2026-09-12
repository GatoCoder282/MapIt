package com.mapit.identity.domain;

import java.util.Objects;

/** Datos privados de verificación nunca se devuelven como respuesta de login. */
public record UserCredentials(
        AuthenticatedUser identity, String passwordHash, boolean active, boolean tenantActive) {
    public UserCredentials {
        Objects.requireNonNull(identity);
        Objects.requireNonNull(passwordHash);
    }

    public boolean canAuthenticate() {
        return active && tenantActive;
    }

    @Override
    public String toString() {
        return "UserCredentials[REDACTED]";
    }
}
