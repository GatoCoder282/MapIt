package com.mapit.platform.infrastructure;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.InvitationToken;
import com.mapit.platform.domain.InvitationTokenRepository;
import com.mapit.shared.tenant.TenantScope;

/**
 * Persistencia JDBC de invitaciones. RLS real: fija el contexto del tenant con
 * SET LOCAL dentro de la transacción antes del INSERT.
 */
@Repository
class JdbcInvitationTokenRepository implements InvitationTokenRepository {

  private final JdbcTemplate jdbc;

  JdbcInvitationTokenRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void save(InvitationToken invitation) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, invitation.tenantId().value());
    jdbc.update(
        """
        insert into invitation_tokens (id, tenant_id, email, token_hash, expires_at)
        values (?, ?, ?, ?, ?)
        """,
        invitation.id(),
        invitation.tenantId().value(),
        invitation.email(),
        invitation.tokenHash(),
        java.sql.Timestamp.from(invitation.expiresAt()));
  }
}
