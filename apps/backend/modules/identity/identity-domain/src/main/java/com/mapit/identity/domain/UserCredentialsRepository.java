package com.mapit.identity.domain;

import java.util.Optional;

/** Consulta de la cuenta de Console antes de emitir el JWT. */
public interface UserCredentialsRepository {
    Optional<UserCredentials> findByEmail(String email);
}
