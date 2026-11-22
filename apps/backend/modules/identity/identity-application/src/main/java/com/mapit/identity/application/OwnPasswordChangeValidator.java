package com.mapit.identity.application;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

import com.mapit.identity.application.OwnPasswordChangeFailure.Reason;
import com.mapit.identity.domain.PasswordVerifier;

/**
 * Valida sin escribir ni emitir credenciales. No es un caso de uso autorizado:
 * el llamador debe autenticar, limitar intentos y cargar el hash propio bloqueado
 * bajo RLS. CommitOwnPasswordChange coordina la escritura y revocación atómicas.
 */
@Component
public final class OwnPasswordChangeValidator {
  private final PasswordVerifier verifier;

  public OwnPasswordChangeValidator(PasswordVerifier verifier) {
    this.verifier = verifier;
  }

  public void validate(OwnPasswordChange command, Optional<String> ownPasswordHash) {
    var current = command.currentPassword();
    var next = command.newPassword();
    var confirmation = command.newPasswordConfirm();
    // Acotar antes de cualquier BCrypt/encoding: no truncar, normalizar o strip.
    if (!withinBcrypt(current) || !withinBcrypt(next) || !withinBcrypt(confirmation)) {
      fail(Reason.INVALID_REQUEST);
    }
    if (!verifier.matches(current, ownPasswordHash)) fail(Reason.INVALID_CURRENT_PASSWORD);
    if (next.codePointCount(0, next.length()) < 8 || PasswordPolicy.validate(next) != null) {
      fail(Reason.INVALID_NEW_PASSWORD);
    }
    if (!next.equals(confirmation)) fail(Reason.CONFIRMATION_MISMATCH);
    // Comparación contra hash, no solo igualdad literal con la entrada actual.
    if (verifier.matches(next, ownPasswordHash)) fail(Reason.PASSWORD_REUSED);
  }

  private static boolean withinBcrypt(@Nullable String value) {
    return value != null && !value.isEmpty() && value.length() <= 72
        && StandardCharsets.UTF_8.newEncoder().canEncode(value)
        && value.getBytes(StandardCharsets.UTF_8).length <= 72;
  }

  private static void fail(Reason reason) {
    throw new OwnPasswordChangeFailure(reason);
  }
}
