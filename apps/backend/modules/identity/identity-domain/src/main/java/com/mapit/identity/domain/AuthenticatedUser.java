package com.mapit.identity.domain;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Identidad verificada para emitir tokens; no contiene secretos. */
public record AuthenticatedUser(UUID id, TenantId tenantId, String email, String fullName, UserRole role) {
    public AuthenticatedUser {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(email);
        Objects.requireNonNull(fullName);
        Objects.requireNonNull(role);
    }
}
