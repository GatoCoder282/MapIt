package com.mapit.identity.application;

import java.time.Clock;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.RecoveryApprovalSource;
import com.mapit.shared.tenant.TenantId;

/** Orquesta la aprobación externa y la emisión sin devolver el enlace al operador. */
@Service
public class StartAdminRecovery {
  private final AdminRecoveryActorVerifier actors;
  private final ObjectProvider<RecoveryApprovalSource> approvalSource;
  private final PrepareAdminRecoveryAuthorization prepare;
  private final IssueAdminRecoveryToken issue;
  private final Clock clock;

  public StartAdminRecovery(AdminRecoveryActorVerifier actors,
      ObjectProvider<RecoveryApprovalSource> approvalSource,
      PrepareAdminRecoveryAuthorization prepare, IssueAdminRecoveryToken issue, Clock clock) {
    this.actors = actors;
    this.approvalSource = approvalSource;
    this.prepare = prepare;
    this.issue = issue;
    this.clock = clock;
  }

  @Transactional
  public UUID execute(String operatorToken, Request request) {
    var operator = actors.verify(operatorToken);
    RecoveryApprovalSource source = approvalSource.getIfAvailable();
    if (source == null) throw new SecurityException("Fuente de aprobación no disponible");
    var evidence = source.find(request.approvalReference())
        .orElseThrow(() -> new SecurityException("Aprobación no comprobable"));
    var now = clock.instant();
    if (!request.approvalReference().equals(evidence.reference())
        || evidence.responsible() == null || evidence.responsible().isBlank()
        || evidence.responsible().equalsIgnoreCase(operator.id().toString())
        || evidence.responsible().equalsIgnoreCase(operator.email())
        || evidence.approvedAt() == null || evidence.approvedAt().isAfter(now)
        || evidence.validFrom() == null || evidence.expiresAt() == null
        || now.isBefore(evidence.validFrom()) || !now.isBefore(evidence.expiresAt())
        || !TenantId.of(request.tenantId()).equals(evidence.targetTenant())
        || !request.tenantSlug().equals(evidence.targetSlug())
        || !request.targetUserId().equals(evidence.targetUser())
        || !request.ticket().equals(evidence.ticket())
        || !request.reason().equals(evidence.reason())) {
      throw new SecurityException("Aprobación fuera de alcance");
    }
    UUID authorizationId = UUID.randomUUID();
    prepare.createPending(operatorToken, new AdminRecoveryAuthorization(authorizationId,
        evidence.targetTenant(), evidence.targetSlug(), evidence.targetUser(), operator.id(),
        evidence.ticket(), evidence.reason(), evidence.validFrom(), evidence.expiresAt()));
    if (!prepare.recordDocumentApproval(operatorToken, authorizationId,
        evidence.reference(), evidence.responsible())) {
      throw new SecurityException("Aprobación no registrada");
    }
    issue.execute(operatorToken, authorizationId);
    return authorizationId;
  }

  public record Request(String tenantId, String tenantSlug, UUID targetUserId,
      String ticket, String reason, String approvalReference) {}
}
