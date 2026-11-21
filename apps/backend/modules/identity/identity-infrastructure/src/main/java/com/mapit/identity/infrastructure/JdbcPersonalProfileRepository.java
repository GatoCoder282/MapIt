package com.mapit.identity.infrastructure;

import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.shared.tenant.TenantScope;

/** Campos existentes de app_user; no escribe autoridad ni utiliza el contexto de login. */
@Repository
@Transactional(propagation = Propagation.MANDATORY)
public class JdbcPersonalProfileRepository implements PersonalProfileRepository {
    private final JdbcTemplate jdbc;

    public JdbcPersonalProfileRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<PersonalProfile> findOwn(AuthenticatedPrincipal actor) {
        scope(actor);
        return jdbc.query("""
                select u.full_name, u.email
                from app_user u join tenant t on t.id = u.tenant_id
                where u.tenant_id = ? and u.id = ? and u.role = ?
                  and u.active = true and t.status = 'ACTIVE'
                """, (rs, row) -> new PersonalProfile(rs.getString("full_name"), rs.getString("email")),
                actor.tenantId().value(), actor.id(), actor.role().name()).stream().findFirst();
    }

    @Override
    public Optional<PersonalProfile> updateOwnFullName(AuthenticatedPrincipal actor, String fullName) {
        scope(actor);
        return jdbc.query("""
                update app_user set full_name = ?
                where tenant_id = ? and id = ? and role = ? and active = true
                  and exists (select 1 from tenant t
                              where t.id = app_user.tenant_id and t.status = 'ACTIVE')
                returning full_name, email
                """, (rs, row) -> new PersonalProfile(rs.getString("full_name"), rs.getString("email")),
                fullName, actor.tenantId().value(), actor.id(), actor.role().name()).stream().findFirst();
    }

    private void scope(AuthenticatedPrincipal actor) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, actor.tenantId().value());
    }
}
