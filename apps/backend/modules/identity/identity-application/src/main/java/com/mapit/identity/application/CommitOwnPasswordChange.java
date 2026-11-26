package com.mapit.identity.application;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.OwnPasswordRepository;
import com.mapit.identity.domain.PasswordHasher;

/** Verifica contra el hash vigente después de adquirir el bloqueo y antes de escribir. */
@Service
public class CommitOwnPasswordChange {
    private final OwnPasswordRepository repository;
    private final OwnPasswordChangeValidator validator;
    private final PasswordHasher hasher;
    private final OwnProfileService profiles;

    public CommitOwnPasswordChange(OwnPasswordRepository repository, OwnPasswordChangeValidator validator,
            PasswordHasher hasher, OwnProfileService profiles) {
        this.repository = repository;
        this.validator = validator;
        this.hasher = hasher;
        this.profiles = profiles;
    }

    @Transactional
    public void execute(AuthenticatedPrincipal actor, OwnPasswordChange command) {
        var credential = repository.lockOwn(actor)
                .orElseThrow(() -> new OwnProfileFailure(OwnProfileFailure.Reason.UNAUTHENTICATED));
        if (actor.issuedAt() == null || !credential.canAuthenticate()
                || !credential.identity().id().equals(actor.id())
                || !credential.identity().tenantId().equals(actor.tenantId())
                || credential.identity().role() != actor.role()
                || (credential.tokensValidAfter() != null && !actor.issuedAt().isAfter(credential.tokensValidAfter()))) {
            throw new OwnProfileFailure(OwnProfileFailure.Reason.UNAUTHENTICATED);
        }
        profiles.read(actor);
        validator.validate(command, Optional.of(credential.passwordHash()));
        var replacement = hasher.hash(Objects.requireNonNull(command.newPassword()));
        if (!repository.replaceOwn(actor, credential.passwordHash(), replacement)) {
            throw new OwnProfileFailure(OwnProfileFailure.Reason.CONFLICT);
        }
    }
}
