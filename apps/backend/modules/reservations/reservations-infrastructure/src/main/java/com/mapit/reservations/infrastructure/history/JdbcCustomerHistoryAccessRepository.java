package com.mapit.reservations.infrastructure.history;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.history.CustomerHistoryAccessRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcCustomerHistoryAccessRepository implements CustomerHistoryAccessRepository {
  private final JdbcTemplate jdbc;

  public JdbcCustomerHistoryAccessRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<TenantId> activeTenant(String slug) {
    return jdbc.query("select id from tenant where slug = ? and status = 'ACTIVE'",
        (rs, row) -> TenantId.of(rs.getString(1)), slug).stream().findFirst();
  }

  @Override
  public void lockPerson(TenantId tenant, UUID person) {
    scope(tenant);
    jdbc.query("select id from person where tenant_id = ? and id = ? and deleted_at is null for update",
        (rs, row) -> rs.getObject(1, UUID.class), tenant.value(), person);
  }

  @Override
  public long recentRequests(TenantId tenant, UUID person, Instant since) {
    scope(tenant);
    Long count = jdbc.queryForObject("""
        select count(*) from customer_history_access
        where tenant_id = ? and person_id = ? and created_at >= ?
        """, Long.class, tenant.value(), person, Timestamp.from(since));
    return count == null ? 0 : count;
  }

  @Override
  public void issue(TenantId tenant, UUID person, String linkHash, Instant expires, Instant now) {
    scope(tenant);
    jdbc.update("""
        insert into customer_history_access (tenant_id, person_id, link_hash, link_expires_at, created_at)
        values (?, ?, ?, ?, ?)
        """, tenant.value(), person, linkHash, Timestamp.from(expires), Timestamp.from(now));
  }

  @Override
  public Optional<UUID> exchange(TenantId tenant, String linkHash, String sessionHash,
      Instant sessionExpires, Instant now) {
    scope(tenant);
    return jdbc.query("""
        update customer_history_access a
        set consumed_at = ?, session_hash = ?, session_expires_at = ?
        where a.tenant_id = ? and a.link_hash = ? and a.consumed_at is null
          and a.link_expires_at > ? and a.revoked_at is null
          and exists (select 1 from person p where p.tenant_id = a.tenant_id
              and p.id = a.person_id and p.deleted_at is null)
        returning a.person_id
        """, (rs, row) -> rs.getObject(1, UUID.class), Timestamp.from(now),
        sessionHash, Timestamp.from(sessionExpires), tenant.value(), linkHash,
        Timestamp.from(now)).stream().findFirst();
  }

  @Override
  public Optional<UUID> validSession(TenantId tenant, String sessionHash, Instant now) {
    scope(tenant);
    return jdbc.query("""
        select person_id from customer_history_access
        where tenant_id = ? and session_hash = ? and consumed_at is not null
          and session_expires_at > ? and revoked_at is null
        """, (rs, row) -> rs.getObject(1, UUID.class), tenant.value(), sessionHash,
        Timestamp.from(now)).stream().findFirst();
  }

  @Override
  public boolean revoke(TenantId tenant, String sessionHash, Instant now) {
    scope(tenant);
    return jdbc.update("""
        update customer_history_access set session_hash = null, revoked_at = ?
        where tenant_id = ? and session_hash = ? and consumed_at is not null
          and session_expires_at > ? and revoked_at is null
        """, Timestamp.from(now), tenant.value(), sessionHash, Timestamp.from(now)) == 1;
  }

  private void scope(TenantId tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
  }
}
