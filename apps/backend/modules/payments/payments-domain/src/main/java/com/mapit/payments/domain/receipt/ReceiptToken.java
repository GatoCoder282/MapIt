package com.mapit.payments.domain.receipt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

/** Credencial opaca de presentación; no demuestra pago ni autoriza un check-in por sí sola. */
public final class ReceiptToken {

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Pattern TOKEN_FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");
  private static final Pattern HASH_FORMAT = Pattern.compile("[a-f0-9]{64}");
  private final String value;

  private ReceiptToken(String value) {
    this.value = value;
  }

  /** Genera 256 bits aleatorios. La emisión de un comprobante requiere validaciones adicionales. */
  public static ReceiptToken generate() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return new ReceiptToken(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
  }

  /** Valor para construir el enlace HTTPS. No persistir ni registrar este valor en logs. */
  public String presentationValue() {
    return value;
  }

  /** Único dato de la credencial que debe almacenarse. */
  public String hash() {
    return hashOf(value);
  }

  public static String hashOf(String presentedToken) {
    Objects.requireNonNull(presentedToken, "presentedToken no puede ser null");
    if (!TOKEN_FORMAT.matcher(presentedToken).matches()) {
      throw new IllegalArgumentException("Formato de comprobante inválido");
    }
    byte[] decoded = Base64.getUrlDecoder().decode(presentedToken);
    // Exige representación canónica: rechaza variantes con bits de relleno diferentes.
    if (decoded.length != 32
        || !Base64.getUrlEncoder().withoutPadding().encodeToString(decoded).equals(presentedToken)) {
      throw new IllegalArgumentException("Formato de comprobante inválido");
    }
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(presentedToken.getBytes(StandardCharsets.US_ASCII)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 no está disponible", exception);
    }
  }

  static void requireHash(String hash) {
    Objects.requireNonNull(hash, "tokenHash no puede ser null");
    if (!HASH_FORMAT.matcher(hash).matches()) {
      throw new IllegalArgumentException("Hash de comprobante inválido");
    }
  }

  /** Compara hashes de tamaño fijo; entradas malformadas se rechazan sin revelar la credencial. */
  public static boolean matches(String presentedToken, String storedHash) {
    requireHash(storedHash);
    try {
      return MessageDigest.isEqual(
          HexFormat.of().parseHex(hashOf(presentedToken)), HexFormat.of().parseHex(storedHash));
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  @Override
  public String toString() {
    return "ReceiptToken[REDACTED]";
  }
}
