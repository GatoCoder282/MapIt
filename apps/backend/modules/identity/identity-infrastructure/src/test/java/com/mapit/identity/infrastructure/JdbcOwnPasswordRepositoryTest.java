package com.mapit.identity.infrastructure;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import com.mapit.identity.domain.*;
import com.mapit.shared.tenant.TenantId;

class JdbcOwnPasswordRepositoryTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final JdbcOwnPasswordRepository repository = new JdbcOwnPasswordRepository(jdbc);
    private final AuthenticatedPrincipal actor = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("tenant-a"), "a@example.test", UserRole.STAFF, Instant.now());
    @Test void locksOnlyItsTenantUserRoleAndUsesOneAtomicCasForHashAndNonDecreasingCutoff() {
        repository.lockOwn(actor);
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), org.mockito.ArgumentMatchers.<RowMapper<UserCredentials>>any(), eq("tenant-a"), eq(actor.id()), eq("STAFF"));
        assertThat(sql.getValue()).contains("for update of u", "u.tenant_id=? and u.id=? and u.role=?", "u.active", "t.status='ACTIVE'");
        when(jdbc.update(anyString(), eq("new-hash"), eq(Timestamp.from(actor.issuedAt())), eq("tenant-a"), eq(actor.id()), eq("STAFF"), eq("old-hash"))).thenReturn(1);
        assertThat(repository.replaceOwn(actor, "old-hash", "new-hash")).isTrue();
        verify(jdbc).update(sql.capture(), eq("new-hash"), eq(Timestamp.from(actor.issuedAt())), eq("tenant-a"), eq(actor.id()), eq("STAFF"), eq("old-hash"));
        assertThat(sql.getValue()).contains("password_hash=?", "staff_tokens_valid_after=greatest", "clock_timestamp()", "password_hash=?", "t.status='ACTIVE'");
        assertThat(sql.getValue().split("where")[0]).doesNotContain("role=", "tenant_id=", "email=", "active=", "full_name=");
    }
}
