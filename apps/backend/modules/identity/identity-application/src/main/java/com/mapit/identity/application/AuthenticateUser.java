package com.mapit.identity.application;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.InvalidCredentialsException;
import com.mapit.identity.domain.PasswordVerifier;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.identity.domain.UserCredentialsRepository;

/** MAP-46: verifica credenciales y estados. */
@Service
public class AuthenticateUser {
    private final UserCredentialsRepository users;
    private final PasswordVerifier passwords;

    public AuthenticateUser(UserCredentialsRepository users, PasswordVerifier passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    public AuthenticatedUser execute(AuthenticateUserCommand command) {
        String password = command.password();
        var credentials = users.findByEmail(validateCredentials(command.email(), password));
        return verify(password, credentials).identity();
    }

    private static String validateCredentials(String email, String password) {
        if (email == null || password == null || password.isBlank()
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new InvalidCredentialsException();
        }
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.length() > 254) {
            throw new InvalidCredentialsException();
        }
        return normalized;
    }

    private UserCredentials verify(String password, Optional<UserCredentials> credentials) {
        // Comparar también cuentas inexistentes o deshabilitadas evita atajos evidentes.
        boolean validPassword = passwords.matches(password, credentials.map(UserCredentials::passwordHash));
        UserCredentials user = credentials.orElseThrow(InvalidCredentialsException::new);
        if (!validPassword || !user.canAuthenticate()) {
            throw new InvalidCredentialsException();
        }
        return user;
    }
}
