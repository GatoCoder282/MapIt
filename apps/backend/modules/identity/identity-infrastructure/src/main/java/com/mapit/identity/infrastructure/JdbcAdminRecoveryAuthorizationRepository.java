package com.mapit.identity.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;
import com.mapit.identity.domain.ApprovedAdminRecoveryAuthorization;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Todas las operaciones usan platform bajo RLS y requieren transacción externa. */
@Repository
class JdbcAdminRecoveryAuthorizationRepository implements AdminRecoveryAuthorizationRepository {
  private final JdbcTemplate jdbc;

  JdbcAdminRecoveryAuthorizationRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void createPending(AdminRecoveryAuthorization request) {
    requireTransaction();
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, request.targetTenant().value());
    Boolean eligible = jdbc.queryForObject("""
        select exists(select 1 from app_user
          where tenant_id=? and id=? and role='ADMIN' and not active)
        """, Boolean.class, request.targetTenant().value(), request.targetUser());
    if (!Boolean.TRUE.equals(eligible)) {
      throw new IllegalStateException("ADMIN destinatario no elegible");
    }
    scope();
    int inserted = jdbc.update("""
        insert into admin_recovery_authorization
          (id, tenant_id, target_tenant_id, target_slug, target_user_id, operator_id,
           ticket, reason, valid_from, expires_at)
        select ?, 'platform', t.id, t.slug, ?, ?, ?, ?, ?, ?
        from tenant t where t.id=? and t.slug=? and t.status='ACTIVE'
        """, request.id(), request.targetUser(), request.operator(), request.ticket(),
        request.reason(), Timestamp.from(request.validFrom()), Timestamp.from(request.expiresAt()),
        request.targetTenant().value(), request.targetSlug());
    if (inserted != 1) throw new IllegalStateException("Tenant destinatario no disponible");
  }

  @Override
  public boolean approve(UUID requestId, UUID operatorId, UUID approverId, Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_authorization
        set status='APPROVED', approver_id=?, approved_at=?
        where tenant_id='platform' and id=? and operator_id=? and operator_id<>?
          and status='PENDING' and valid_from<=? and expires_at>?
        """, approverId, Timestamp.from(at), requestId, operatorId, approverId,
        Timestamp.from(at), Timestamp.from(at)) == 1;
  }

  @Override
  public boolean recordDocumentApproval(UUID requestId, UUID operatorId, String reference,
      String responsible, Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_authorization
        set status='APPROVED', approval_reference=?, approval_responsible=?, approved_at=?
        where tenant_id='platform' and id=? and operator_id=? and status='PENDING'
          and valid_from<=? and expires_at>? and position(ticket in ?) > 0
        """, reference, responsible, Timestamp.from(at), requestId, operatorId,
        Timestamp.from(at), Timestamp.from(at), reference) == 1;
  }


  @Override
  public boolean revoke(UUID requestId, Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_authorization set status='REVOKED', revoked_at=?
        where tenant_id='platform' and id=? and status in ('PENDING','APPROVED')
        """, Timestamp.from(at), requestId) == 1;
  }

  @Override
  public Optional<ApprovedAdminRecoveryAuthorization> findUsable(UUID requestId, Instant at) {
    scope();
    return jdbc.query("""
        select a.id,a.target_tenant_id,a.target_slug,a.target_user_id,a.operator_id,a.approver_id,
               a.ticket,a.reason,a.valid_from,a.expires_at,
               a.approval_reference,a.approval_responsible
        from admin_recovery_authorization a join tenant t
          on t.id=a.target_tenant_id and t.slug=a.target_slug and t.status='ACTIVE'
        where a.tenant_id='platform' and a.id=? and a.status='APPROVED'
          and a.valid_from<=? and a.expires_at>?
        for update of a
        """, (rs, row) -> new ApprovedAdminRecoveryAuthorization(new AdminRecoveryAuthorization(rs.getObject("id", UUID.class),
            TenantId.of(rs.getString("target_tenant_id")), rs.getString("target_slug"),
            rs.getObject("target_user_id", UUID.class), rs.getObject("operator_id", UUID.class),
            rs.getString("ticket"), rs.getString("reason"),
            rs.getTimestamp("valid_from").toInstant(), rs.getTimestamp("expires_at").toInstant()),
            rs.getObject("approver_id", UUID.class), rs.getString("approval_reference"),
            rs.getString("approval_responsible")),
        requestId, Timestamp.from(at), Timestamp.from(at)).stream().findFirst();
  }

  @Override
  public boolean consume(UUID requestId, UUID operatorId, UUID approverId, Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_authorization
        set status='CONSUMED', consumed_at=?
        where tenant_id='platform' and id=? and operator_id=? and approver_id=?
          and status='APPROVED' and valid_from<=? and expires_at>?
        """, Timestamp.from(at), requestId, operatorId, approverId,
        Timestamp.from(at), Timestamp.from(at)) == 1;
  }

  @Override
  public boolean consumeDocumentApproval(UUID requestId, UUID operatorId, String reference,
      Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_authorization
        set status='CONSUMED', consumed_at=?
        where tenant_id='platform' and id=? and operator_id=? and approver_id is null
          and approval_reference=? and approval_responsible is not null
          and status='APPROVED' and valid_from<=? and expires_at>?
        """, Timestamp.from(at), requestId, operatorId, reference,
        Timestamp.from(at), Timestamp.from(at)) == 1;
  }

  private void scope() {
    requireTransaction();
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "platform");
  }

  private void requireTransaction() {
    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
      throw new IllegalStateException("La autorización requiere transacción activa");
    }
  }
}
