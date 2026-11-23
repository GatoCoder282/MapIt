package com.mapit.identity.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Escrituras de aprobación scoped a platform; consumo reservado para el rescate futuro. */
public interface AdminRecoveryAuthorizationRepository {
  void createPending(AdminRecoveryAuthorization authorization);

  boolean approve(UUID requestId, UUID operatorId, UUID approverId, Instant at);

  /** Registrar referencia ya contrastada por el procedimiento de plataforma. */
  boolean recordDocumentApproval(UUID requestId, UUID operatorId, String reference,
      String responsible, Instant at);

  boolean revoke(UUID requestId, Instant at);

  Optional<ApprovedAdminRecoveryAuthorization> findUsable(UUID requestId, Instant at);

  boolean consume(UUID requestId, UUID operatorId, UUID approverId, Instant at);

  boolean consumeDocumentApproval(UUID requestId, UUID operatorId, String reference, Instant at);
}
