package com.mapit.operations.domain.audit;

import java.util.List;

/** Página inmutable del histórico, ordenada de forma descendente por instante e id. */
public record AuditLogPage(
    List<AuditLog> content, int page, int size, long totalElements, int totalPages) {

  public AuditLogPage {
    content = List.copyOf(content);
    if (page < 0 || size < 1 || totalElements < 0 || totalPages < 0) {
      throw new IllegalArgumentException("La información de paginación no es válida");
    }
  }
}
