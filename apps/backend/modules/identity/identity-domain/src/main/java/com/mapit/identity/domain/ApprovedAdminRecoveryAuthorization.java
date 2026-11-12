package com.mapit.identity.domain;

import java.util.Objects;
import java.util.UUID;

/** Aprobación V33: firmante legado o referencia documental revisada por plataforma. */
public record ApprovedAdminRecoveryAuthorization(AdminRecoveryAuthorization request, UUID approverId,
    String approvalReference, String approvalResponsible) {
  public ApprovedAdminRecoveryAuthorization(AdminRecoveryAuthorization request, UUID approverId) {
    this(request, approverId, null, null);
  }

  public ApprovedAdminRecoveryAuthorization {
    Objects.requireNonNull(request);
    if (approverId != null) {
      if (request.operator().equals(approverId)
          || approvalReference != null || approvalResponsible != null) {
        throw new IllegalArgumentException("Aprobación de doble SUPER_ADMIN inválida");
      }
    } else if (approvalReference == null || approvalReference.isBlank()
        || approvalResponsible == null || approvalResponsible.isBlank()) {
      throw new IllegalArgumentException("Aprobación documental incompleta");
    }
  }
}
