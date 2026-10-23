package com.mapit.identity.domain;

/** Hash de contraseñas; la implementación es BCrypt en infraestructura. */
public interface PasswordHasher {

  String hash(String rawPassword);
}
