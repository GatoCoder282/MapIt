package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/** Datos privados de verificación nunca se devuelven como respuesta de login. */
public record UserCredentials(
        AuthenticatedUser identity, String passwordHash, boolean active, boolean tenantActive,
        @Nullable Instant tokensValidAfter, @Nullable Instant observedAt) {
    public UserCredentials(AuthenticatedUser identity, String hash, boolean active, boolean tenantActive) {
        this(identity, hash, active, tenantActive, null, null);
    }
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
