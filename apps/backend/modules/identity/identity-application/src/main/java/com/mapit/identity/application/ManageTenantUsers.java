package com.mapit.identity.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.TenantUser;
import com.mapit.identity.domain.TenantUserRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;

/** Política de administración de cuentas, comprobada contra la fila actual bajo RLS. */
@Service
public class ManageTenantUsers {
  private final TenantUserRepository users;
  private final AuditEventRecorder audit;
  private final Clock clock;

  public ManageTenantUsers(TenantUserRepository users, AuditEventRecorder audit, Clock clock) {
    this.users = users;
    this.audit = audit;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Page list(AuthenticatedPrincipal principal, int page, int size) {
    if (page < 0 || size < 1 || size > 100) throw new BadRequest("Paginación inválida.");
    authorize(principal);
    long count = users.count(principal.tenantId());
    List<TenantUser> content = users.list(principal.tenantId(), size, (long) page * size);
    return new Page(content, page, size, count, Math.toIntExact(Math.ceilDiv(count, (long) size)));
  }

  @Transactional(readOnly = true)
  public TenantUser get(AuthenticatedPrincipal principal, UUID id) {
    authorize(principal);
    return target(principal, id);
  }

  @Transactional
  public TenantUser changeRole(
      AuthenticatedPrincipal principal, UUID id, UserRole expected, UserRole next) {
    authorize(principal);
    memberRole(expected);
    memberRole(next);
    TenantUser current = editableTarget(principal, id);
    if (current.role() != expected || !current.active()) throw new Conflict("La cuenta cambió.");
    if (expected == next) return current; // No hay cambio efectivo ni evento de éxito.
    if (!users.changeRole(principal.tenantId(), id, expected, next)) {
      throw new Conflict("La cuenta cambió.");
    }
    audit.record(new AuditEvent(UUID.randomUUID(), principal.tenantId(), principal.id(),
        clock.instant(), AuditResourceType.USER, id, AuditEventType.USER_ROLE_CHANGED,
        Map.of("previousRole", expected.name(), "newRole", next.name())));
    return target(principal, id);
  }

  @Transactional
  public TenantUser deactivate(AuthenticatedPrincipal principal, UUID id) {
    authorize(principal);
    TenantUser current = editableTarget(principal, id);
    if (!current.active()) return current; // Idempotencia sin evento inventado.
    if (!users.deactivate(principal.tenantId(), id, current.role())) {
      throw new Conflict("La cuenta cambió.");
    }
    audit.record(new AuditEvent(UUID.randomUUID(), principal.tenantId(), principal.id(),
        clock.instant(), AuditResourceType.USER, id, AuditEventType.USER_DEACTIVATED,
        Map.of("previousActive", "true", "newActive", "false")));
    return target(principal, id);
  }

  /** Protección común para la futura emisión y reemisión, aún no conectadas a CU-25. */
  @Transactional(readOnly = true)
  public void authorizeInvitation(AuthenticatedPrincipal principal, UserRole role) {
    authorize(principal);
    memberRole(role);
  }

  @Transactional(readOnly = true)
  public void authorizeResend(AuthenticatedPrincipal principal) {
    authorize(principal);
  }

  private void authorize(AuthenticatedPrincipal principal) {
    if (principal == null || principal.tenantId().value().equals("platform")) {
      throw new Forbidden("Solo un ADMIN del tenant puede gestionar usuarios.");
    }
    TenantUser actor = users.findById(principal.tenantId(), principal.id())
        .orElseThrow(() -> new Unauthenticated("Cuenta no vigente."));
    if (!actor.active() || !users.tenantActive(principal.tenantId()) ||
        actor.role() != principal.role()) throw new Unauthenticated("Cuenta no vigente.");
    if (actor.role() != UserRole.ADMIN) throw new Forbidden("Solo ADMIN puede gestionar usuarios.");
  }

  private TenantUser target(AuthenticatedPrincipal principal, UUID id) {
    return users.findById(principal.tenantId(), id)
        .orElseThrow(() -> new NotFound("Usuario no encontrado."));
  }

  private TenantUser editableTarget(AuthenticatedPrincipal principal, UUID id) {
    if (principal.id().equals(id)) throw new Forbidden("No se permite autogestión.");
    TenantUser current = target(principal, id);
    memberRole(current.role());
    return current;
  }

  private void memberRole(UserRole role) {
    if (role != UserRole.MANAGER && role != UserRole.STAFF) {
      throw new Forbidden("Solo se permite gestionar MANAGER y STAFF.");
    }
  }

  public record Page(List<TenantUser> content, int page, int size, long totalElements, int totalPages) {}
  public static class Forbidden extends RuntimeException { public Forbidden(String message) { super(message); } }
  public static class Unauthenticated extends RuntimeException { public Unauthenticated(String message) { super(message); } }
  public static class BadRequest extends RuntimeException { public BadRequest(String message) { super(message); } }
  public static class NotFound extends RuntimeException { public NotFound(String message) { super(message); } }
  public static class Conflict extends RuntimeException { public Conflict(String message) { super(message); } }
}
