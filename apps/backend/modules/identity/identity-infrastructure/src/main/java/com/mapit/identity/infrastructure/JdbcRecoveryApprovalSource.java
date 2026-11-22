package com.mapit.identity.infrastructure;

import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.identity.domain.RecoveryApprovalSource;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Lee evidencia registrada con una credencial PostgreSQL ajena a mapit_app. */
@Repository
class JdbcRecoveryApprovalSource implements RecoveryApprovalSource {
  private final JdbcTemplate jdbc;

  JdbcRecoveryApprovalSource(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<Approval> find(String reference) {
    scope();
    lockReference(reference);
    return jdbc.query("""
        select e.reference, e.approver_login, e.approved_at, e.valid_from, e.expires_at,
               e.target_tenant_id, e.target_slug, e.target_user_id, e.ticket, e.reason
        from admin_recovery_approval_evidence e
        where e.tenant_id='platform' and e.reference=? and e.revoked_at is null
          and not exists (select 1 from admin_recovery_authorization a
                          where a.tenant_id='platform' and a.approval_reference=e.reference)
        """, (rs, row) -> new Approval(rs.getString("reference"),
            rs.getString("approver_login"), rs.getTimestamp("approved_at").toInstant(),
            rs.getTimestamp("valid_from").toInstant(), rs.getTimestamp("expires_at").toInstant(),
            TenantId.of(rs.getString("target_tenant_id")), rs.getString("target_slug"),
            rs.getObject("target_user_id", java.util.UUID.class), rs.getString("ticket"),
            rs.getString("reason")), reference).stream().findFirst();
  }

  @Override
  public boolean isRevokedIfRegistered(String reference) {
    scope();
    lockReference(reference);
    return Boolean.TRUE.equals(jdbc.queryForObject("""
        select coalesce((select revoked_at is not null
                         from admin_recovery_approval_evidence
                         where tenant_id='platform' and reference=?), false)
        """, Boolean.class, reference));
  }

  private void scope() {
    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
      throw new IllegalStateException("La evidencia requiere transacción activa");
    }
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "platform");
  }

  private void lockReference(String reference) {
    jdbc.queryForList("select pg_advisory_xact_lock(hashtextextended(?, 0))", reference);
  }
}
