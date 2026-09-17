package com.mapit.platform.application;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

import org.springframework.stereotype.Component;

/**
 * Genera tokens de invitación: 32 bytes aleatorios criptográficos en base64url
 * (sin padding) para la URL, y solo su hash SHA-256 para persistencia.
 */
@Component
public class SecureTokenGenerator {

  /** 32 bytes ≈ 256 bits de entropía: fuerza bruta inviable antes de la caducidad. */
  private static final int TOKEN_BYTES = 32;

  private static final java.util.Base64.Encoder URL_ENCODER =
      java.util.Base64.getUrlEncoder().withoutPadding();

  private final SecureRandom random = new SecureRandom();

  /** Token opaco para el enlace (única vez que existe en claro). */
  public String newToken() {
    byte[] bytes = new byte[TOKEN_BYTES];
    random.nextBytes(bytes);
    return URL_ENCODER.encodeToString(bytes);
  }

  /** Hash persistible del token: lo que viaja a la base de datos. */
  public String hash(String token) {
    try {
      return HexFormat.of().formatHex(
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
    }
  }
}
