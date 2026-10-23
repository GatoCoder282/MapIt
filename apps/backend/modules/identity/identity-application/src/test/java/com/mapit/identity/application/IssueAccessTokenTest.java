package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.IssuedAccessToken;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class IssueAccessTokenTest {
    @Test
    void delega_la_emision_con_la_identidad_verificada() {
        var user = new AuthenticatedUser(UUID.randomUUID(), TenantId.of("tenant-a"),
                "staff@example.test", "Operador", UserRole.ADMIN);
        var expected = new IssuedAccessToken("token", Instant.parse("2026-09-09T12:15:00Z"));
        var useCase = new IssueAccessToken(received -> {
            assertThat(received).isSameAs(user);
            return expected;
        });

        assertThat(useCase.execute(user)).isSameAs(expected);
    }
}
