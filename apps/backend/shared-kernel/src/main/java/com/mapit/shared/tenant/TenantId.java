package com.mapit.shared.tenant;

import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Identificador de un tenant (empresa) de la plataforma.
 *
 * <p>Es un value object en vez de un {@code String} para que el compilador impida
 * confundirlo con cualquier otro identificador de texto. Ver plan §12 (multi-tenant).
 */
public record TenantId(String value) {

  private static final Pattern FORMATO = Pattern.compile("^[a-z0-9][a-z0-9-]{1,62}$");

  public TenantId {
    Objects.requireNonNull(value, "El tenantId no puede ser null");
    if (!FORMATO.matcher(value).matches()) {
      throw new IllegalArgumentException(
          "TenantId inválido: '%s'. Debe ser minúsculas, dígitos y guiones (2-63 caracteres)."
              .formatted(value));
    }
  }

  public static TenantId of(String value) {
    return new TenantId(value);
  }

  /** Genera un identificador opaco que no depende de los datos proporcionados por el cliente. */
  public static TenantId generate() {
    return new TenantId(UUID.randomUUID().toString());
  }

  @Override
  public String toString() {
    return value;
  }
}
