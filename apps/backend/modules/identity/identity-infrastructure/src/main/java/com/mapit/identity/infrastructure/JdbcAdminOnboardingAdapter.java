package com.mapit.identity.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.identity.domain.AppUserCreator;
import com.mapit.identity.domain.InvitationTokenStore;
import com.mapit.identity.domain.StoredInvitation;
import com.mapit.identity.domain.TenantDirectory;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/**
 * Acceso JDBC a `invitation_tokens` + alta del `app_user`, dentro de la RLS:
 * cada operación fija el tenant con SET LOCAL en la transacción en curso.
 */
@Repository
class JdbcAdminOnboardingAdapter implements InvitationTokenStore, AppUserCreator, TenantDirectory {

  private final JdbcTemplate jdbc;

  JdbcAdminOnboardingAdapter(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<TenantId> findIdBySlug(String slug) {
    return findTenantBySlug(slug);
  }

  @Override
  public Optional<TenantId> findTenantBySlug(String slug) {
    // tenant es tabla global (sin RLS): el slug es solo el índice del enlace
    // público; la invitación sigue protegiéndose bajo RLS del tenant resuelto.
    return jdbc
        .queryForList("select id from tenant where slug = ?", String.class, slug)
        .stream()
        .map(TenantId::of)
        .findFirst();
  }

  @Override
  public Optional<StoredInvitation> findByTokenHash(TenantId tenantId, String tokenHash) {
    setTenant(tenantId);
    return jdbc
        .query(
            """
            select id, tenant_id, email, expires_at, consumed_at
            from invitation_tokens
            where token_hash = ? and tenant_id = ?
            """,
            (rs, rowNum) ->
                new StoredInvitation(
                    rs.getObject("id", UUID.class),
                    TenantId.of(rs.getString("tenant_id")),
                    rs.getString("email"),
                    rs.getTimestamp("expires_at").toInstant(),
                    rs.getTimestamp("consumed_at") == null
                        ? null
                        : rs.getTimestamp("consumed_at").toInstant()),
            tokenHash,
            tenantId.value())
        .stream()
        .findFirst();
  }

  @Override
  public boolean markConsumed(UUID invitationId, UUID userId) {
    return jdbc.update(
            "update invitation_tokens set consumed_at = now(), user_id = ? where id = ? and consumed_at is null",
            userId,
            invitationId)
        == 1;
  }

  @Override
  public UUID create(TenantId tenantId, String email, String fullName, String passwordHash, UserRole role) {
    setTenant(tenantId);
    UUID id = UUID.randomUUID();
    jdbc.update(
        """
        insert into app_user (id, tenant_id, email, password_hash, full_name, role)
        values (?, ?, ?, ?, ?, ?)
        """,
        id,
        tenantId.value(),
        email,
        passwordHash,
        fullName,
        role.name());
    return id;
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
