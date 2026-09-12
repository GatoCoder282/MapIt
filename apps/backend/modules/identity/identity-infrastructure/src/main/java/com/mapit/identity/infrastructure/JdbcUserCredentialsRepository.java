package com.mapit.identity.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.identity.domain.UserCredentialsRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

/** Consulta de credenciales anterior al JWT, aislada del contexto de cualquier petición. */
@Repository
public class JdbcUserCredentialsRepository implements UserCredentialsRepository {
    private final JdbcTemplate jdbc;

    public JdbcUserCredentialsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<UserCredentials> findByTenantSlugAndEmail(String tenantSlug, String email) {
        List<String> tenants = jdbc.queryForList("select id from tenant where slug = ?", String.class, tenantSlug);
        if (tenants.isEmpty()) {
            return Optional.empty();
        }
        String tenantId = tenants.getFirst();
        // Parámetro ligado, alcance LOCAL: no queda en la conexión al terminar la transacción.
        jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId);
        return jdbc.query("""
                select u.id, u.tenant_id, u.email, u.full_name, u.role, u.password_hash,
                       u.active, t.status = 'ACTIVE' as tenant_active
                from app_user u join tenant t on t.id = u.tenant_id
                where u.tenant_id = ? and u.email = ?
                """, (rs, rowNum) -> new UserCredentials(
                        new AuthenticatedUser(rs.getObject("id", UUID.class),
                                TenantId.of(rs.getString("tenant_id")), rs.getString("email"),
                                rs.getString("full_name"), UserRole.valueOf(rs.getString("role"))),
                        rs.getString("password_hash"), rs.getBoolean("active"),
                        rs.getBoolean("tenant_active")), tenantId, email).stream().findFirst();
    }
}
