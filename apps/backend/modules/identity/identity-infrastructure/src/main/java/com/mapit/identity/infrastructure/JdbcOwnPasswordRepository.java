package com.mapit.identity.infrastructure;

import java.sql.Timestamp;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.OwnPasswordRepository;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.shared.tenant.TenantScope;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
public class JdbcOwnPasswordRepository implements OwnPasswordRepository {
    private final JdbcTemplate jdbc;

    public JdbcOwnPasswordRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<UserCredentials> lockOwn(AuthenticatedPrincipal actor) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, actor.tenantId().value());
        return jdbc.query(JdbcUserCredentialsRepository.SELECT_ACCOUNT + """
                where u.tenant_id=? and u.id=? and u.role=? and u.active and t.status='ACTIVE'
                for update of u
                """, JdbcUserCredentialsRepository.ACCOUNT, actor.tenantId().value(), actor.id(), actor.role().name())
                .stream().findFirst();
    }

    @Override
    public boolean replaceOwn(AuthenticatedPrincipal actor, String expectedHash, String replacementHash) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, actor.tenantId().value());
        return jdbc.update("""
                update app_user set password_hash=?,
                    staff_tokens_valid_after=greatest(staff_tokens_valid_after,clock_timestamp(),cast(? as timestamptz))
                where tenant_id=? and id=? and role=? and active and password_hash=?
                  and exists(select 1 from tenant t where t.id=app_user.tenant_id and t.status='ACTIVE')
                """, replacementHash, Timestamp.from(actor.issuedAt()), actor.tenantId().value(),
                actor.id(), actor.role().name(), expectedHash) == 1;
    }
}
