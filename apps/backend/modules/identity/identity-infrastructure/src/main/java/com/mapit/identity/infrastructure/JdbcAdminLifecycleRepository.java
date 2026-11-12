package com.mapit.identity.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.identity.domain.AdminLifecycleRepository;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
class JdbcAdminLifecycleRepository implements AdminLifecycleRepository {
  private final JdbcTemplate jdbc;

  JdbcAdminLifecycleRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public boolean lockTenant(TenantId tenant) {
    return !jdbc.queryForList("select id from tenant where id=? and status='ACTIVE' for update",
        String.class, tenant.value()).isEmpty();
  }

  @Override
  public boolean lockActiveAdmin(TenantId tenant, UUID userId) {
    scope(tenant);
    return !jdbc.queryForList("""
        select id from app_user where tenant_id=? and id=? and role='ADMIN' and active for update
        """, UUID.class, tenant.value(), userId).isEmpty();
  }

  @Override
  public boolean lockInactiveAdmin(TenantId tenant, UUID userId) {
    scope(tenant);
    return !jdbc.queryForList("""
        select id from app_user where tenant_id=? and id=? and role='ADMIN' and not active for update
        """, UUID.class, tenant.value(), userId).isEmpty();
  }

  @Override
  public boolean lockRecoveryTenant(TenantId tenant, String slug) {
    return !jdbc.queryForList("""
        select id from tenant where id=? and slug=? and status='ACTIVE' for update
        """, String.class, tenant.value(), slug).isEmpty();
  }

  @Override
  public boolean lockPlatformAuthorizers(AuthenticatedPrincipal operator,
      AuthenticatedPrincipal approver) {
    scope(TenantId.of("platform"));
    var rows = jdbc.query("""
        select id,staff_tokens_valid_after from app_user
        where tenant_id='platform' and id in (?,?) and role='SUPER_ADMIN' and active
        order by id for update
        """, (rs, row) -> new AuthorizerRow(rs.getObject("id", UUID.class),
            rs.getTimestamp("staff_tokens_valid_after") == null ? null
                : rs.getTimestamp("staff_tokens_valid_after").toInstant()),
        operator.id(), approver.id());
    return rows.size() == 2 && rows.stream().allMatch(row ->
        valid(row, operator) || valid(row, approver));
  }

  private boolean valid(AuthorizerRow row, AuthenticatedPrincipal principal) {
    return row.id().equals(principal.id()) && (row.cutoff() == null
        || (principal.issuedAt() != null && principal.issuedAt().isAfter(row.cutoff())));
  }

  private record AuthorizerRow(UUID id, Instant cutoff) {}

  @Override
  public boolean lockPlatformOperator(AuthenticatedPrincipal operator) {
    scope(TenantId.of("platform"));
    var rows = jdbc.query("""
        select id,staff_tokens_valid_after from app_user
        where tenant_id='platform' and id=? and role='SUPER_ADMIN' and active for update
        """, (rs, row) -> new AuthorizerRow(rs.getObject("id", UUID.class),
            rs.getTimestamp("staff_tokens_valid_after") == null ? null
                : rs.getTimestamp("staff_tokens_valid_after").toInstant()), operator.id());
    return rows.size() == 1 && valid(rows.getFirst(), operator);
  }

  @Override
  public boolean lockPlatformOperator(UUID operatorId) {
    scope(TenantId.of("platform"));
    return !jdbc.queryForList("""
        select id from app_user where tenant_id='platform' and id=?
          and role='SUPER_ADMIN' and active for update
        """, UUID.class, operatorId).isEmpty();
  }

  @Override
  public Optional<String> inactiveAdminEmail(TenantId tenant, UUID userId) {
    scope(tenant);
    return jdbc.queryForList("""
        select email from app_user where tenant_id=? and id=?
          and role='ADMIN' and not active
        """, String.class, tenant.value(), userId).stream().findFirst();
  }

  @Override
  public Optional<String> inactiveAdminPasswordHash(TenantId tenant, UUID userId) {
    scope(tenant);
    return jdbc.queryForList("""
        select password_hash from app_user
        where tenant_id=? and id=? and role='ADMIN' and not active
        """, String.class, tenant.value(), userId).stream().findFirst();
  }

  @Override
  public boolean recoverInactiveAdmin(TenantId tenant, UUID userId, String passwordHash,
      Instant cutoff) {
    scope(tenant);
    return jdbc.update("""
        update app_user set password_hash=?, staff_tokens_valid_after=?, active=true
        where tenant_id=? and id=? and role='ADMIN' and not active
        """, passwordHash, Timestamp.from(cutoff), tenant.value(), userId) == 1;
  }

  @Override
  public long activeAdmins(TenantId tenant) {
    scope(tenant);
    return jdbc.queryForObject("""
        select count(*) from app_user where tenant_id=? and role='ADMIN' and active
        """, Long.class, tenant.value());
  }

  @Override
  public boolean deactivateAdmin(TenantId tenant, UUID userId) {
    scope(tenant);
    return jdbc.update("""
        update app_user set active=false where tenant_id=? and id=? and role='ADMIN' and active
        """, tenant.value(), userId) == 1;
  }

  @Override
  public boolean changeAdminRole(TenantId tenant, UUID userId, UserRole nextRole) {
    scope(tenant);
    return jdbc.update("""
        update app_user set role=? where tenant_id=? and id=? and role='ADMIN' and active
        """, nextRole.name(), tenant.value(), userId) == 1;
  }

  private void scope(TenantId tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
  }
}
