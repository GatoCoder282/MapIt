package com.mapit.identity.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.identity.domain.TenantUser;
import com.mapit.identity.domain.TenantUserRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Consulta exclusivamente app_user del tenant autorizado, con SET LOCAL transaccional. */
@Repository
class JdbcTenantUserRepository implements TenantUserRepository {
  private final JdbcTemplate jdbc;

  JdbcTenantUserRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<TenantUser> findById(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("""
        select id, full_name, email, role, active, created_at from app_user
        where tenant_id = ? and id = ?
        """, (rs, row) -> map(rs), tenant.value(), id).stream().findFirst();
  }

  @Override
  public boolean tenantActive(TenantId tenant) {
    scope(tenant);
    return Boolean.TRUE.equals(jdbc.queryForObject(
        "select exists(select 1 from tenant where id = ? and status = 'ACTIVE')",
        Boolean.class, tenant.value()));
  }

  @Override
  public long count(TenantId tenant) {
    scope(tenant);
    return jdbc.queryForObject("select count(*) from app_user where tenant_id = ? and role in ('ADMIN','MANAGER','STAFF')", Long.class, tenant.value());
  }

  @Override
  public List<TenantUser> list(TenantId tenant, int size, long offset) {
    scope(tenant);
    return jdbc.query("""
        select id, full_name, email, role, active, created_at from app_user
        where tenant_id = ? and role in ('ADMIN','MANAGER','STAFF')
        order by created_at asc, id asc limit ? offset ?
        """, (rs, row) -> map(rs), tenant.value(), size, offset);
  }

  @Override
  public boolean changeRole(TenantId tenant, UUID id, UserRole expected, UserRole next) {
    scope(tenant);
    return jdbc.update("""
        update app_user set role = ?
        where tenant_id = ? and id = ? and role = ? and active = true
          and role in ('MANAGER', 'STAFF')
        """, next.name(), tenant.value(), id, expected.name()) == 1;
  }

  @Override
  public boolean deactivate(TenantId tenant, UUID id, UserRole expected) {
    scope(tenant);
    return jdbc.update("""
        update app_user set active = false
        where tenant_id = ? and id = ? and role = ? and active = true
          and role in ('MANAGER', 'STAFF')
        """, tenant.value(), id, expected.name()) == 1;
  }

  private TenantUser map(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new TenantUser(rs.getObject("id", UUID.class), rs.getString("full_name"),
        rs.getString("email"), UserRole.valueOf(rs.getString("role")),
        rs.getBoolean("active"), rs.getTimestamp("created_at").toInstant());
  }

  private void scope(TenantId tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
  }
}
