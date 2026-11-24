package com.mapit.identity.application;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.identity.domain.*;
import com.mapit.shared.tenant.TenantId;

class OpenStaffSessionTest {
    private final AuthenticateUser authentication = mock(AuthenticateUser.class);
    private final IssueAccessToken tokens = mock(IssueAccessToken.class);
    private final OpenStaffSession sessions = new OpenStaffSession(authentication, tokens);
    private final AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), TenantId.of("tenant-a"), "a@example.test", "A", UserRole.ADMIN);
    private final AuthenticateUserCommand command = new AuthenticateUserCommand(user.email(), "private-test-value");
    private final Instant at = Instant.parse("2026-11-22T12:00:01.900Z");
    @Test void blocksSameSecondAndMissingTrustedTimeWithoutIssuingFutureTokens() {
        for (Instant cutoff : new Instant[] {at, at.minusMillis(500), at.truncatedTo(java.time.temporal.ChronoUnit.SECONDS)}) {
            when(authentication.authenticate(command)).thenReturn(new UserCredentials(user, "hash", true, true, cutoff, at));
            assertThatThrownBy(() -> sessions.execute(command)).isInstanceOf(TokenIssuanceNotReady.class);
        }
        when(authentication.authenticate(command)).thenReturn(new UserCredentials(user, "hash", true, true));
        assertThatThrownBy(() -> sessions.execute(command)).isInstanceOf(TokenIssuanceNotReady.class);
        verifyNoInteractions(tokens);
    }
    @Test void issuesOnlyAfterAuthenticationWithTheLockedDatabaseTimeAndNewSecond() {
        when(authentication.authenticate(command)).thenReturn(new UserCredentials(user, "hash", true, true, at.minusSeconds(1), at));
        when(tokens.execute(user, at)).thenReturn(new IssuedAccessToken("private-jwt", at.plusSeconds(900)));
        var result = sessions.execute(command);
        assertThat(result.user()).isEqualTo(user); assertThat(result.toString()).doesNotContain("private-jwt", command.password());
        var order = inOrder(authentication, tokens); order.verify(authentication).authenticate(command); order.verify(tokens).execute(user, at);
        verify(tokens, never()).execute(user);
    }
}
