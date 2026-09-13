package com.mapit.identity.application;

import org.jspecify.annotations.Nullable;

/** Entrada del caso de uso; la contraseña no debe aparecer en logs. */
public record AuthenticateUserCommand(
        @Nullable String tenantSlug, @Nullable String email, @Nullable String password) {
    @Override
    public String toString() {
        return "AuthenticateUserCommand[REDACTED]";
    }
}
