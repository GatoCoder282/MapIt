package com.mapit.operations.domain.audit;

import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto append-only para persistir y recuperar una entrada del tenant. */
public interface AuditLogRepository {

  void append(AuditLog auditLog);

  Optional<AuditLog> findById(TenantId tenantId, UUID id);

  AuditLogPage search(TenantId tenantId, AuditLogFilter filter, int page, int size);
}
