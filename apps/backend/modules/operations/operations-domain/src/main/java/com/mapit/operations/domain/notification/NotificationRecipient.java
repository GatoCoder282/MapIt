package com.mapit.operations.domain.notification;

import java.util.Objects;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Identidad de la bandeja. En aplicación se deriva del principal, nunca del cliente. */
public record NotificationRecipient(TenantId tenantId, UUID userId) {
    public NotificationRecipient {
        Objects.requireNonNull(tenantId, "tenantId no puede ser null");
        Objects.requireNonNull(userId, "userId no puede ser null");
    }
}
