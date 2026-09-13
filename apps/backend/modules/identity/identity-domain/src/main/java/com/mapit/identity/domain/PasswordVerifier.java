package com.mapit.identity.domain;

import java.util.Optional;

/** Comparación segura*/
public interface PasswordVerifier {
    boolean matches(String rawPassword, Optional<String> passwordHash);
}
