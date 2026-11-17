package com.mapit.identity.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.identity.domain.UserCredentialsRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Consulta de credenciales anterior al JWT, aislada del contexto de cualquier petición. */
@Repository
public class JdbcUserCredentialsRepository implements UserCredentialsRepository {
    private static final String SELECT_ACCOUNT = """
            select u.id, u.tenant_id, u.email, u.full_name, u.role, u.password_hash,
                   u.active, t.status = 'ACTIVE' as tenant_active
            from app_user u join tenant t on t.id = u.tenant_id
            """;

    private static final RowMapper<UserCredentials> ACCOUNT = (rs, rowNum) -> new UserCredentials(
                    new AuthenticatedUser(rs.getObject("id", UUID.class),
                            TenantId.of(rs.getString("tenant_id")), rs.getString("email"),
                            rs.getString("full_name"), UserRole.valueOf(rs.getString("role"))),
                    rs.getString("password_hash"), rs.getBoolean("active"),
                    rs.getBoolean("tenant_active"));

    private final JdbcTemplate jdbc;

    public JdbcUserCredentialsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<UserCredentials> findByEmail(String email) {
        // La política RLS permite leer exclusivamente el correo de esta transacción.
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "");
        jdbc.queryForObject("select set_config('app.login_email', ?, true)", String.class, email);
        return jdbc.query(SELECT_ACCOUNT + "where u.email = ?", ACCOUNT, email).stream().findFirst();
    }
}
