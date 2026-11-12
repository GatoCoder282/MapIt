package com.mapit.identity.domain;

import java.time.Instant;
import java.util.UUID;

/** Proyección de una cuenta; no expone credenciales ni datos de otro tenant. */
public record TenantUser(
    UUID id, String fullName, String email, UserRole role, boolean active, Instant createdAt) {}
