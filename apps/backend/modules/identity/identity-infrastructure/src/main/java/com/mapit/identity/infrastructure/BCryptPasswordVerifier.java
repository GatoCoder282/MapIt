package com.mapit.identity.infrastructure;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.PasswordVerifier;

/** Usa el codificador BCrypt configurado en bootstrap y nunca registra contraseñas. */
@Component
public class BCryptPasswordVerifier implements PasswordVerifier {
    private final PasswordEncoder encoder;
    private final String dummyHash;

    public BCryptPasswordVerifier(PasswordEncoder encoder) {
        this.encoder = encoder;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
    }

    @Override
    public boolean matches(String rawPassword, Optional<String> passwordHash) {
        if (rawPassword.isBlank() || rawPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            return false;
        }
        String hash = passwordHash.orElse(dummyHash);
        // Un hash corrupto falla cerrado y tampoco evita el coste de BCrypt.
        boolean validHash = hash.matches("\\$2[aby]\\$(0[4-9]|[12][0-9]|3[01])\\$[./A-Za-z0-9]{53}");
        boolean matched = encoder.matches(rawPassword, validHash ? hash : dummyHash);
        return passwordHash.isPresent() && validHash && matched;
    }
}
