package com.mapit.shared.flags;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Contexto staff derivado del servidor; sessionId es un nonce opaco, nunca JWT o credencial. */
public record FeatureFlagContext(TenantId tenantId, UUID userId, String sessionId) {
    public FeatureFlagContext {
        Objects.requireNonNull(tenantId, "tenantId no puede ser null");
        Objects.requireNonNull(userId, "userId no puede ser null");
        Objects.requireNonNull(sessionId, "sessionId no puede ser null");
        if (!sessionId.matches("[A-Za-z0-9_-]{1,128}")) {
            throw new IllegalArgumentException("Contexto de sesión inválido");
        }
    }
}
