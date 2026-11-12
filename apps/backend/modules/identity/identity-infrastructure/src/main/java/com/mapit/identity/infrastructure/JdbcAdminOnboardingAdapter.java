package com.mapit.identity.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.identity.domain.AppUserCreator;
import com.mapit.identity.domain.InvitationPurpose;
import com.mapit.identity.domain.InvitationTokenStore;
import com.mapit.identity.domain.MemberInvitation;
import com.mapit.identity.domain.MemberInvitationRepository;
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
class JdbcAdminOnboardingAdapter implements InvitationTokenStore, AppUserCreator, TenantDirectory,
    MemberInvitationRepository {

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
  public boolean lockActiveTenant(TenantId tenantId) {
    // El tenant es global, pero el id se resuelve del slug y no del body de un staff.
    var rows = jdbc.queryForList("select status from tenant where id = ? for update", String.class,
        tenantId.value());
    return !rows.isEmpty() && "ACTIVE".equals(rows.getFirst());
  }

  @Override
  public Optional<StoredInvitation> findByTokenHash(TenantId tenantId, String tokenHash) {
    setTenant(tenantId);
    return jdbc
        .query(
            """
             select id, tenant_id, email, expires_at, consumed_at, revoked_at, purpose, target_role
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
                         : rs.getTimestamp("consumed_at").toInstant(),
                     rs.getTimestamp("revoked_at") == null
                         ? null
                         : rs.getTimestamp("revoked_at").toInstant(),
                     InvitationPurpose.valueOf(rs.getString("purpose")),
                     rs.getString("target_role") == null ? null : UserRole.valueOf(rs.getString("target_role"))),
            tokenHash,
            tenantId.value())
        .stream()
        .findFirst();
  }

  @Override
  public boolean markConsumed(TenantId tenantId, UUID invitationId, UUID userId) {
    setTenant(tenantId);
    return jdbc.update(
            """
            update invitation_tokens set consumed_at = now(), user_id = ?
            where tenant_id = ? and id = ? and consumed_at is null and revoked_at is null
              and expires_at > now()
            """,
            userId,
            tenantId.value(),
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

  @Override
  public TenantInfo tenantInfo(TenantId tenant) {
    return jdbc.queryForObject("select name, slug from tenant where id = ?",
        (rs, row) -> new TenantInfo(rs.getString("name"), rs.getString("slug")), tenant.value());
  }

  @Override
  public boolean userExists(TenantId tenant, String email) {
    setTenant(tenant);
    return Boolean.TRUE.equals(jdbc.queryForObject(
        "select exists(select 1 from app_user where tenant_id=? and email=?)",
        Boolean.class, tenant.value(), email));
  }

  @Override
  public Optional<MemberInvitation> pending(TenantId tenant, String email) {
    setTenant(tenant);
    return jdbc.query("""
        select id,email,target_role,expires_at,consumed_at,revoked_at,
               dispatch_status,dispatch_attempted_at from invitation_tokens
        where tenant_id=? and email=? and purpose='MEMBER'
          and consumed_at is null and revoked_at is null
        """, (rs, row) -> mapMember(rs), tenant.value(), email).stream().findFirst();
  }

  @Override
  public Optional<MemberInvitation> byId(TenantId tenant, UUID id) {
    setTenant(tenant);
    return jdbc.query("""
        select id,email,target_role,expires_at,consumed_at,revoked_at,
               dispatch_status,dispatch_attempted_at from invitation_tokens
        where tenant_id=? and id=? and purpose='MEMBER'
        """, (rs, row) -> mapMember(rs), tenant.value(), id).stream().findFirst();
  }

  @Override
  public long countRecoverable(TenantId tenant) {
    setTenant(tenant);
    return jdbc.queryForObject("""
        select count(*) from invitation_tokens
        where tenant_id=? and purpose='MEMBER' and consumed_at is null and revoked_at is null
        """, Long.class, tenant.value());
  }

  @Override
  public java.util.List<MemberInvitation> listRecoverable(TenantId tenant, int size, long offset) {
    setTenant(tenant);
    return jdbc.query("""
        select id,email,target_role,expires_at,consumed_at,revoked_at,
               dispatch_status,dispatch_attempted_at from invitation_tokens
        where tenant_id=? and purpose='MEMBER' and consumed_at is null and revoked_at is null
        order by created_at desc, id desc limit ? offset ?
        """, (rs, row) -> mapMember(rs), tenant.value(), size, offset);
  }

  @Override
  public boolean revoke(TenantId tenant, UUID id) {
    setTenant(tenant);
    return jdbc.update("""
        update invitation_tokens set revoked_at=now()
        where tenant_id=? and id=? and purpose='MEMBER'
          and consumed_at is null and revoked_at is null
        """, tenant.value(), id) == 1;
  }

  @Override
  public MemberInvitation insert(TenantId tenant, UUID id, String email, UserRole role,
      UUID invitedBy, String hash) {
    setTenant(tenant);
    return jdbc.queryForObject("""
        insert into invitation_tokens
          (id,tenant_id,email,purpose,target_role,invited_by,token_hash,expires_at,dispatch_status)
        values (?,?,?,'MEMBER',?,?,?,now() + interval '24 hours','SEND_REQUESTED')
        returning id,email,target_role,expires_at,consumed_at,revoked_at,
                  dispatch_status,dispatch_attempted_at
        """, (rs, row) -> mapMember(rs), id, tenant.value(), email, role.name(), invitedBy, hash);
  }

  private static MemberInvitation mapMember(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new MemberInvitation(rs.getObject("id", UUID.class), rs.getString("email"),
        UserRole.valueOf(rs.getString("target_role")), rs.getTimestamp("expires_at").toInstant(),
        rs.getTimestamp("consumed_at") == null ? null : rs.getTimestamp("consumed_at").toInstant(),
        rs.getTimestamp("revoked_at") == null ? null : rs.getTimestamp("revoked_at").toInstant(),
        rs.getString("dispatch_status"),
        rs.getTimestamp("dispatch_attempted_at") == null ? null
            : rs.getTimestamp("dispatch_attempted_at").toInstant());
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
