package com.mapit.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;

/** Etapa preparatoria sin ejecutor registrado ni capacidad de restaurar cuentas. */
@Service
public class PrepareAdminRecoveryAuthorization {
  private final AdminRecoveryActorVerifier actors;
  private final AdminRecoveryAuthorizationRepository repository;
  private final Clock clock;

  public PrepareAdminRecoveryAuthorization(AdminRecoveryActorVerifier actors,
      AdminRecoveryAuthorizationRepository repository, Clock clock) {
    this.actors = actors;
    this.repository = repository;
    this.clock = clock;
  }

  @Transactional
  public void createPending(String operatorToken, AdminRecoveryAuthorization request) {
    UUID operator = actors.verify(operatorToken).id();
    if (!operator.equals(request.operator()) || !request.expiresAt().isAfter(clock.instant())) {
      throw new SecurityException("Solicitud de recuperación no autorizada");
    }
    repository.createPending(request);
  }

  @Transactional
  public boolean approve(String operatorToken, String approverToken, UUID requestId) {
    UUID operator = actors.verify(operatorToken).id();
    UUID approver = actors.verify(approverToken).id();
    if (operator.equals(approver)) {
      throw new SecurityException("La aprobación requiere otra persona");
    }
    Instant now = clock.instant();
    return repository.approve(requestId, operator, approver, now);
  }

  /** Solo registra evidencia documental contrastada fuera de la aplicación. */
  @Transactional
  public boolean recordDocumentApproval(String operatorToken, UUID requestId,
      String reference, String responsible) {
    UUID operator = actors.verify(operatorToken).id();
    if (reference == null || reference.isBlank() || reference.length() > 240
        || responsible == null || responsible.isBlank() || responsible.length() > 120
        || responsible.equalsIgnoreCase(operator.toString())) {
      throw new IllegalArgumentException("Referencia de aprobación inválida");
    }
    return repository.recordDocumentApproval(requestId, operator, reference.strip(),
        responsible.strip(), clock.instant());
  }

}
