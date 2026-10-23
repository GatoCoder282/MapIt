package com.mapit.spaces.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Identificador del establecimiento en las URLs públicas de reserva (CU-15).
 *
 * <p>Es un value object y no un {@code String} por la misma razón que {@link
 * com.mapit.shared.tenant.TenantId}: el compilador impide confundirlo con el nombre o
 * con cualquier otro texto, y la validación de formato vive en un solo sitio en vez de
 * repetirse en el controlador, el servicio y los tests.
 *
 * <p>No normaliza a minúsculas a propósito: el contrato OpenAPI ya rechaza mayúsculas
 * con un {@code 400}, así que aceptarlas aquí en silencio haría que dominio y contrato
 * discreparan sobre qué es válido.
 */
public record Slug(String value) {

  private static final Pattern FORMATO = Pattern.compile("^[a-z0-9][a-z0-9-]{1,62}$");

  public Slug {
    Objects.requireNonNull(value, "El slug no puede ser null");
    value = value.trim();
    if (!FORMATO.matcher(value).matches()) {
      throw new IllegalArgumentException(
          "Slug inválido: '%s'. Debe ser minúsculas, dígitos y guiones (2-63 caracteres)."
              .formatted(value));
    }
  }

  public static Slug of(String value) {
    return new Slug(value);
  }

  /**
   * Deriva un slug válido desde un nombre legible ("Salón Principal" → "salon-principal").
   *
   * <p>El contrato (CU-05) dice que el slug se autogenera en el servidor y el cliente no
   * lo envía. La centralidad está aquí, no en el controlador: cualquier caso de uso que
   * reciba un slug vacío puede derivarlo sin duplicar la lógica.
   */
  public static Slug fromName(String name) {
    Objects.requireNonNull(name, "El nombre no puede ser null");
    String normalizado =
        Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    String candidato =
        normalizado
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
    if (candidato.isEmpty()) {
      throw new IllegalArgumentException(
          "No se puede derivar un slug del nombre: '%s'".formatted(name));
    }
    // El formato exige [a-z0-9] primero y 2..63 caracteres.
    candidato = candidato.length() < 2 ? candidato + "-" + candidato : candidato;
    return new Slug(candidato.length() > 63 ? candidato.substring(0, 63) : candidato);
  }

  @Override
  public String toString() {
    return value;
  }
}
