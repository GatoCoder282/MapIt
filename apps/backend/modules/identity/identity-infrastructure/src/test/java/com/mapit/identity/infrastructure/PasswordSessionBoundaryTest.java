package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import com.mapit.identity.domain.*;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

class PasswordSessionBoundaryTest {
    private final Instant second = Instant.parse("2026-11-22T12:00:00Z");
    private final AuthenticatedPrincipal actor = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("tenant-a"), "staff@example.test", UserRole.STAFF, second);

    @Test
    void loginDerivesTenantBeforeLockAndReadsDatabaseClockOnlyAfterTheLock() {
        var jdbc = mock(JdbcTemplate.class);
        var identity = new AuthenticatedUser(actor.id(), actor.tenantId(), actor.email(), "Staff", actor.role());
        var credentials = new UserCredentials(identity, "private-hash", true, true);
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<UserCredentials>>any(), eq(actor.email()))).thenReturn(List.of(credentials));
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<UserCredentials>>any(), eq("tenant-a"), eq(actor.id()), eq(actor.email()))).thenReturn(List.of(credentials));
        when(jdbc.queryForObject("select clock_timestamp()", Timestamp.class)).thenReturn(Timestamp.from(second.plusNanos(750_000)));
        var result = new JdbcUserCredentialsRepository(jdbc).findByEmail(actor.email()).orElseThrow();
        var order = inOrder(jdbc);
        order.verify(jdbc).queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "");
        order.verify(jdbc).queryForObject("select set_config('app.login_email', ?, true)", String.class, actor.email());
        order.verify(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<UserCredentials>>any(), eq(actor.email()));
        order.verify(jdbc).queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "tenant-a");
        order.verify(jdbc).queryForObject("select set_config('app.login_email', '', true)", String.class);
        order.verify(jdbc).query(contains("for update of u"), org.mockito.ArgumentMatchers.<RowMapper<UserCredentials>>any(), eq("tenant-a"), eq(actor.id()), eq(actor.email()));
        order.verify(jdbc).queryForObject("select clock_timestamp()", Timestamp.class);
        assertThat(result.observedAt()).isEqualTo(second.plusNanos(750_000));
        assertThat(result.toString()).doesNotContain("private-hash");
    }

    @Test
    void sharedHttpAndStompIdentityReaderRejectsEqualAndSubsecondCutoffs() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var row = mock(ResultSet.class);
        when(row.getString("role")).thenReturn("STAFF");
        when(row.getString("email")).thenReturn(actor.email());
        when(row.getObject("id", UUID.class)).thenReturn(actor.id());
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<?>>any(), eq("tenant-a"), eq(actor.id())))
                .thenAnswer(call -> List.of(call.<RowMapper<?>>getArgument(1).mapRow(row, 0)));
        var reader = new JdbcCurrentStaffIdentity(jdbc);
        for (var cutoff : new Instant[] {second, second.plusNanos(1), second.plusNanos(999_999_000)}) {
            when(row.getTimestamp("staff_tokens_valid_after")).thenReturn(Timestamp.from(cutoff));
            assertThat(reader.resolve(actor)).isEmpty();
        }
        when(row.getTimestamp("staff_tokens_valid_after")).thenReturn(Timestamp.from(second.minusNanos(1)));
        assertThat(reader.resolve(actor)).contains(actor);
        when(row.getString("role")).thenReturn("ADMIN");
        assertThat(reader.resolve(actor)).isEmpty();
    }
}
