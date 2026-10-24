package com.mapit.operations.application.audit;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.audit.AuditLogFilter;
import com.mapit.operations.domain.audit.AuditLogPage;
import com.mapit.operations.domain.audit.AuditLogRepository;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantContext;

/** Consulta paginada de la bitácora del tenant presente en el JWT. */
@Service
public class ListAuditLogs {

  public static final int MAX_PAGE_SIZE = 100;

  private final AuditLogRepository repository;
  private final TenantContext tenantContext;

  public ListAuditLogs(AuditLogRepository repository, TenantContext tenantContext) {
    this.repository = repository;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public AuditLogPage execute(
      @Nullable AuditResourceType resourceType,
      @Nullable AuditEventType eventType,
      @Nullable UUID resourceId,
      @Nullable Instant from,
      @Nullable Instant to,
      int page,
      int size) {
    if (page < 0) {
      throw new IllegalArgumentException("La página debe ser un entero mayor o igual a 0");
    }
    if (size < 1 || size > MAX_PAGE_SIZE) {
      throw new IllegalArgumentException("El tamaño de página debe estar entre 1 y 100");
    }
    if (from != null && to != null && from.isAfter(to)) {
      throw new IllegalArgumentException("El instante inicial no puede ser posterior al final");
    }
    return repository.search(
        tenantContext.require(),
        new AuditLogFilter(resourceType, eventType, resourceId, from, to),
        page,
        size);
  }
}
