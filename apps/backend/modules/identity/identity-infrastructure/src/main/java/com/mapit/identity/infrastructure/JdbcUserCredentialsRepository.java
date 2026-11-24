package com.mapit.identity.infrastructure;

import java.sql.Timestamp;
import java.util.Objects;
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
    static final String SELECT_ACCOUNT = """
            select u.id, u.tenant_id, u.email, u.full_name, u.role, u.password_hash,
                   u.active, t.status = 'ACTIVE' as tenant_active, u.staff_tokens_valid_after
            from app_user u join tenant t on t.id = u.tenant_id
            """;

    static final RowMapper<UserCredentials> ACCOUNT = (rs, rowNum) -> {
        var cutoff = rs.getTimestamp("staff_tokens_valid_after");
        return new UserCredentials(
                    new AuthenticatedUser(rs.getObject("id", UUID.class),
                            TenantId.of(rs.getString("tenant_id")), rs.getString("email"),
                            rs.getString("full_name"), UserRole.valueOf(rs.getString("role"))),
                    rs.getString("password_hash"), rs.getBoolean("active"),
                    rs.getBoolean("tenant_active"), cutoff == null ? null : cutoff.toInstant(), null);
    };

    private final JdbcTemplate jdbc;

    public JdbcUserCredentialsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public Optional<UserCredentials> findByEmail(String email) {
        var previousScope = jdbc.queryForMap("""
                select current_setting('app.tenant_id', true) as tenant,
                       current_setting('app.login_email', true) as login_email
                """);
        RuntimeException failure = null;
        try {
            return findAndLockByEmail(email);
        } catch (RuntimeException cause) {
            failure = cause;
            throw cause;
        } finally {
            try {
                // Restaurar el ámbito prestado no libera el bloqueo: dura hasta el commit exterior.
                jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class,
                        Objects.toString(previousScope.get("tenant"), ""));
                jdbc.queryForObject("select set_config('app.login_email', ?, true)", String.class,
                        Objects.toString(previousScope.get("login_email"), ""));
            } catch (RuntimeException restoreFailure) {
                // PostgreSQL puede haber abortado la transacción; conservar el error original.
                if (failure == null) throw restoreFailure;
                failure.addSuppressed(restoreFailure);
            }
        }
    }

    private Optional<UserCredentials> findAndLockByEmail(String email) {
        // La política RLS permite leer exclusivamente el correo de esta transacción.
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "");
        jdbc.queryForObject("select set_config('app.login_email', ?, true)", String.class, email);
        var found = jdbc.query(SELECT_ACCOUNT + "where u.email = ?", ACCOUNT, email).stream().findFirst();
        if (found.isEmpty()) return Optional.empty();
        var identity = found.orElseThrow().identity();
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, identity.tenantId().value());
        jdbc.queryForObject("select set_config('app.login_email', '', true)", String.class);
        // El login_email solo permite descubrimiento. El bloqueo usa el tenant real bajo RLS.
        var locked = jdbc.query(SELECT_ACCOUNT + "where u.tenant_id = ? and u.id = ? and u.email = ? for update of u", ACCOUNT,
                identity.tenantId().value(), identity.id(), email).stream().findFirst();
        if (locked.isEmpty()) return Optional.empty();
        var credential = locked.orElseThrow();
        var now = Objects.requireNonNull(jdbc.queryForObject("select clock_timestamp()", Timestamp.class)).toInstant();
        return Optional.of(new UserCredentials(credential.identity(), credential.passwordHash(),
                credential.active(), credential.tenantActive(), credential.tokensValidAfter(), now));
    }
}
