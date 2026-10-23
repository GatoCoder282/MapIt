package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Objects;

/** Token opaco emitido para transporte; su representación nunca revela el valor firmado. */
public final class IssuedAccessToken {
    private final String value;
    private final Instant expiresAt;

    public IssuedAccessToken(String value, Instant expiresAt) {
        this.value = Objects.requireNonNull(value);
        this.expiresAt = Objects.requireNonNull(expiresAt);
    }

    public String value() {
        return value;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    @Override
    public String toString() {
        return "IssuedAccessToken[value=<redacted>, expiresAt=" + expiresAt + "]";
    }
}
