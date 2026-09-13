package com.mapit.identity.domain;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Identidad reconstruida exclusivamente desde un token de acceso validado. */
public record AuthenticatedPrincipal(UUID id, TenantId tenantId, String email, UserRole role) {
    public AuthenticatedPrincipal {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(email);
        Objects.requireNonNull(role);
    }
}
