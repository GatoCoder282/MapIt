package com.mapit.identity.infrastructure;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.PasswordHasher;

/** Hash BCrypt vía el PasswordEncoder global. Nunca persiste en claro. */
@Component
class BCryptPasswordHasher implements PasswordHasher {

  private final PasswordEncoder encoder;

  BCryptPasswordHasher(PasswordEncoder encoder) {
    this.encoder = encoder;
  }

  @Override
  public String hash(String rawPassword) {
    return encoder.encode(rawPassword);
  }
}
