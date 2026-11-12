package com.mapit.identity.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.CurrentStaffIdentity;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantScope;

/** Una lectura indexada por (tenant_id,id), con RLS y sin heredar contexto del pool. */
@Repository
class JdbcCurrentStaffIdentity implements CurrentStaffIdentity {
  private final JdbcTemplate jdbc;

  JdbcCurrentStaffIdentity(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
  public Optional<AuthenticatedPrincipal> resolve(AuthenticatedPrincipal signed) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, signed.tenantId().value());
    return jdbc.query("""
        select u.id,u.email,u.role,u.staff_tokens_valid_after
        from app_user u join tenant t on t.id=u.tenant_id
        where u.tenant_id=? and u.id=? and u.active and t.status='ACTIVE'
        """, (rs, row) -> {
          UserRole role = UserRole.valueOf(rs.getString("role"));
          var cutoff = rs.getTimestamp("staff_tokens_valid_after");
          if (cutoff != null && (signed.issuedAt() == null
              || !signed.issuedAt().isAfter(cutoff.toInstant()))) {
            return Optional.<AuthenticatedPrincipal>empty();
          }
          return Optional.of(new AuthenticatedPrincipal(rs.getObject("id", UUID.class),
              signed.tenantId(), rs.getString("email"), role, signed.issuedAt()));
        }, signed.tenantId().value(), signed.id()).stream()
        .flatMap(Optional::stream)
        .filter(principal -> principal.role() == signed.role()
            && (principal.role() == UserRole.SUPER_ADMIN)
                == "platform".equals(signed.tenantId().value()))
        .findFirst();
  }
}
