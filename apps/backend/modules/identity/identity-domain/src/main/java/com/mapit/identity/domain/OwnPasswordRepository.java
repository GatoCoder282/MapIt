package com.mapit.identity.domain;
import java.util.Optional;
/** Bloqueo compartido con login; exige RLS y transacción hasta commit. */
public interface OwnPasswordRepository {
    Optional<UserCredentials> lockOwn(AuthenticatedPrincipal actor);
    boolean replaceOwn(AuthenticatedPrincipal actor, String expectedHash, String replacementHash);
}
