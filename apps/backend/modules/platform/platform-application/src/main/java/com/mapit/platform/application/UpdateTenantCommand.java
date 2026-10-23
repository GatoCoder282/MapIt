package com.mapit.platform.application;

import com.mapit.platform.domain.TenantStatus;

/**
 * Edición parcial de un tenant. Solo `name` y `status` son editables:
 * `slug` y `vertical` son inmutables por dominio y ni siquiera aparecen aquí.
 * Un campo null significa "sin cambio"; al menos uno debe venir informado (lo
 * garantiza el contrato: minProperties = 1).
 */
public record UpdateTenantCommand(String id, String name, TenantStatus status) {}
