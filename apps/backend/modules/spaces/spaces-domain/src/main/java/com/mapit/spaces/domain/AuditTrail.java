package com.mapit.spaces.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Rastro de auditoría de una fila: quién y cuándo la creó, la modificó y la dio de baja.
 *
 * <p>Se agrupa en un value object en vez de dejar seis campos sueltos en {@link
 * Establishment} porque son un concepto cohesionado: siempre se leen y se escriben
 * juntos, y las transiciones válidas (crear → tocar → dar de baja) se pueden expresar
 * como métodos en vez de repartirse por el servicio. Eso evita el antipatrón
 * <em>Anemic Domain Model</em> que señala {@code docs/architecture/design-patterns.md}.
 *
 * <p>Los campos {@code *By} son opcionales porque la autenticación llega en CU-23/CU-24:
 * hasta entonces no hay usuario que registrar y se persisten nulos.
 */
public record AuditTrail(
    Instant createdAt,
    UUID createdBy,
    Instant updatedAt,
    UUID updatedBy,
    Instant deletedAt,
    UUID deletedBy) {

  public AuditTrail {
    Objects.requireNonNull(createdAt, "createdAt no puede ser null");
    Objects.requireNonNull(updatedAt, "updatedAt no puede ser null");
    if (deletedBy != null && deletedAt == null) {
      throw new IllegalArgumentException(
          "No puede haber autor de la baja sin fecha de baja");
    }
    if (updatedAt.isBefore(createdAt)) {
      throw new IllegalArgumentException("updatedAt no puede ser anterior a createdAt");
    }
  }

  /** Rastro inicial de una fila recién creada. Todavía no se ha modificado ni dado de baja. */
  public static AuditTrail created(Instant now, UUID by) {
    return new AuditTrail(now, by, now, by, null, null);
  }

  /** Devuelve una copia que registra una modificación, conservando la creación. */
  public AuditTrail touched(Instant now, UUID by) {
    return new AuditTrail(createdAt, createdBy, now, by, deletedAt, deletedBy);
  }

  /** Devuelve una copia marcada como dada de baja. La fila nunca se borra físicamente. */
  public AuditTrail deleted(Instant now, UUID by) {
    return new AuditTrail(createdAt, createdBy, now, by, now, by);
  }

  public boolean isDeleted() {
    return deletedAt != null;
  }

  public Optional<UUID> author() {
    return Optional.ofNullable(createdBy);
  }

  public Optional<UUID> lastEditor() {
    return Optional.ofNullable(updatedBy);
  }
}
