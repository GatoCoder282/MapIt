package com.mapit.identity.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.identity.domain.AdminRecoveryTokenRepository;
import com.mapit.shared.tenant.TenantScope;

@Repository
class JdbcAdminRecoveryTokenRepository implements AdminRecoveryTokenRepository {
  private final JdbcTemplate jdbc;

  JdbcAdminRecoveryTokenRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void issue(UUID authorizationId, String tokenHash, Instant expiresAt) {
    scope();
    if (jdbc.update("""
        insert into admin_recovery_token (tenant_id,authorization_id,token_hash,expires_at)
        select 'platform',a.id,?,? from admin_recovery_authorization a
        where a.tenant_id='platform' and a.id=? and a.status='APPROVED'
          and a.approver_id is null and a.approval_reference is not null
          and a.valid_from<=now() and a.expires_at>now()
        """, tokenHash, Timestamp.from(expiresAt), authorizationId) != 1) {
      throw new SecurityException("Autorización de rescate no disponible");
    }
  }

  @Override
  public Optional<UUID> lockUsable(String tokenHash, Instant at) {
    scope();
    return jdbc.queryForList("""
        select authorization_id from admin_recovery_token
        where tenant_id='platform' and token_hash=? and consumed_at is null and expires_at>?
        for update
        """, UUID.class, tokenHash, Timestamp.from(at)).stream().findFirst();
  }

  @Override
  public boolean consume(String tokenHash, Instant at) {
    scope();
    return jdbc.update("""
        update admin_recovery_token set consumed_at=?
        where tenant_id='platform' and token_hash=? and consumed_at is null and expires_at>?
        """, Timestamp.from(at), tokenHash, Timestamp.from(at)) == 1;
  }

  private void scope() {
    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
      throw new IllegalStateException("El token requiere transacción activa");
    }
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "platform");
  }
}
