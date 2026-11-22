package com.mapit.identity.infrastructure;

import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.MemberInvitationDelivery.Status;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Actualiza únicamente la fila aún vigente en una transacción post-commit independiente. */
@Repository
class JdbcMemberInvitationDispatch {
  private final JdbcTemplate jdbc;

  JdbcMemberInvitationDispatch(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public boolean start(TenantId tenant, UUID invitationId) {
    scope(tenant);
    return jdbc.update("""
        update invitation_tokens set dispatch_status='SEND_REQUESTED',dispatch_attempted_at=now()
        where tenant_id=? and id=? and purpose='MEMBER' and consumed_at is null
          and revoked_at is null and expires_at > now()
        """, tenant.value(), invitationId) == 1;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void finish(TenantId tenant, UUID invitationId, Status status) {
    scope(tenant);
    jdbc.update("""
        update invitation_tokens set dispatch_status=?
        where tenant_id=? and id=? and purpose='MEMBER' and consumed_at is null
          and revoked_at is null
        """, status.name(), tenant.value(), invitationId);
  }

  private void scope(TenantId tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
  }
}
