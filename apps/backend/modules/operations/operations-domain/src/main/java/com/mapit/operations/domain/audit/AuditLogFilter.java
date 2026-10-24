package com.mapit.operations.domain.audit;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;

/** Filtros opcionales, siempre aplicados dentro del tenant autenticado. */
public record AuditLogFilter(
    @Nullable AuditResourceType resourceType,
    @Nullable AuditEventType eventType,
    @Nullable UUID resourceId,
    @Nullable Instant from,
    @Nullable Instant to) {}
