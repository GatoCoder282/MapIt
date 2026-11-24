package com.mapit.identity.application;
import org.springframework.stereotype.Service;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.OwnPasswordAttemptLimiter;

/** Presupuesto en transacción independiente, antes del bloqueo escritor. */
@Service
public class ChangeOwnPassword {
    private final OwnProfileService profiles;
    private final OwnPasswordAttemptLimiter limiter;
    private final CommitOwnPasswordChange writer;

    public ChangeOwnPassword(OwnProfileService profiles, OwnPasswordAttemptLimiter limiter, CommitOwnPasswordChange writer) {
        this.profiles = profiles;
        this.limiter = limiter;
        this.writer = writer;
    }

    public void execute(AuthenticatedPrincipal actor, OwnPasswordChange command, String remoteAddress) {
        profiles.read(actor);
        limiter.checkPasswordChange(actor, remoteAddress);
        writer.execute(actor, command);
    }
}
