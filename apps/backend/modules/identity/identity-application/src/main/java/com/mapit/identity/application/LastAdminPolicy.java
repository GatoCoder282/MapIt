package com.mapit.identity.application;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AdminLifecycleRepository;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.CurrentStaffIdentity;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;

/** Política interna, sin endpoint: todos los futuros escritores privilegiados deben usarla. */
@Service
public class LastAdminPolicy {
  private final AdminLifecycleRepository repository;
  private final CurrentStaffIdentity identities;
  private final AuditEventRecorder audit;
  private final Clock clock;

  public LastAdminPolicy(AdminLifecycleRepository repository, CurrentStaffIdentity identities,
      AuditEventRecorder audit, Clock clock) {
    this.repository = repository;
    this.identities = identities;
    this.audit = audit;
    this.clock = clock;
  }

  @Transactional
  public void deactivate(AuthenticatedPrincipal operator, TenantId tenant, UUID target) {
    mutate(operator, tenant, target, null);
  }

  @Transactional
  public void degrade(AuthenticatedPrincipal operator, TenantId tenant, UUID target, UserRole nextRole) {
    if (nextRole != UserRole.MANAGER && nextRole != UserRole.STAFF) {
      throw new IllegalArgumentException("Rol de destino inválido");
    }
    mutate(operator, tenant, target, nextRole);
  }

  private void mutate(AuthenticatedPrincipal operator, TenantId tenant, UUID target, UserRole nextRole) {
    if (operator == null || operator.role() != UserRole.SUPER_ADMIN
        || !"platform".equals(operator.tenantId().value())
        || identities.resolve(operator).isEmpty()
        || tenant == null || "platform".equals(tenant.value())) {
      throw new SecurityException("Operador de plataforma no vigente");
    }
    // Todos los escritores ordinarios de ADMIN deben respetar este orden:
    // tenant global -> objetivo bajo RLS -> recuento -> UPDATE -> auditoría.
    if (!repository.lockTenant(tenant) || !repository.lockActiveAdmin(tenant, target)) {
      throw new IllegalStateException("ADMIN no disponible");
    }
    if (repository.activeAdmins(tenant) <= 1) {
      throw new IllegalStateException("Debe quedar al menos un ADMIN activo");
    }
    boolean changed = nextRole == null ? repository.deactivateAdmin(tenant, target)
        : repository.changeAdminRole(tenant, target, nextRole);
    if (!changed) throw new IllegalStateException("ADMIN cambió concurrentemente");
    // Un actor de platform no puede figurar como actor del tenant destino (FK compuesta).
    // El resourceId UUID global identifica el usuario afectado; el procedimiento de
    // plataforma debe conservar además la evidencia autorizada y tenant de destino.
    audit.record(new AuditEvent(UUID.randomUUID(), operator.tenantId(), operator.id(), clock.instant(),
        AuditResourceType.USER, target,
        nextRole == null ? AuditEventType.USER_DEACTIVATED : AuditEventType.USER_ROLE_CHANGED,
        nextRole == null ? Map.of("previousActive", "true", "newActive", "false")
            : Map.of("previousRole", "ADMIN", "newRole", nextRole.name())));
  }
}
