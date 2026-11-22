package com.mapit.identity.application;

import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.IssuedAccessToken;
import com.mapit.identity.domain.TokenIssuanceNotReady;

/** La credencial se valida y el JWT se firma antes de soltar el mismo bloqueo que usa el cambio. */
@Service
public class OpenStaffSession {
    private final AuthenticateUser authentication;
    private final IssueAccessToken tokens;

    public OpenStaffSession(AuthenticateUser authentication, IssueAccessToken tokens) {
        this.authentication = authentication;
        this.tokens = tokens;
    }

    @Transactional
    public Session execute(AuthenticateUserCommand command) {
        var credential = authentication.authenticate(command);
        var observedAt = credential.observedAt();
        if (observedAt == null || (credential.tokensValidAfter() != null
                && !observedAt.truncatedTo(ChronoUnit.SECONDS).isAfter(credential.tokensValidAfter()))) {
            throw new TokenIssuanceNotReady();
        }
        return new Session(credential.identity(), tokens.execute(credential.identity(), observedAt));
    }
    public record Session(AuthenticatedUser user, IssuedAccessToken token) {
        @Override
        public String toString() {
            return "StaffSession[REDACTED]";
        }
    }
}
