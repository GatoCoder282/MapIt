package com.mapit.platform.application;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationDecisionEmailPort;
import com.mapit.platform.domain.BusinessApplicationRepository;
import com.mapit.platform.domain.BusinessApplicationStatus;
import com.mapit.platform.domain.PlatformApplicationScope;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.security.ActorContext;

/** Serializa decisiones y reutiliza el alta con invitación de CU-25. */
@Service
public class DecideBusinessApplication {
  private final BusinessApplicationRepository applications;
  private final PlatformApplicationScope scope;
  private final TenantService tenants;
  private final TenantRepository tenantRepository;
  private final AuditEventRecorder audit;
  private final ActorContext actors;
  private final Clock clock;
  private final BusinessApplicationDecisionEmailPort decisionEmail;

  public DecideBusinessApplication(BusinessApplicationRepository applications,
      PlatformApplicationScope scope, TenantService tenants, TenantRepository tenantRepository,
      AuditEventRecorder audit, ActorContext actors, Clock clock,
      BusinessApplicationDecisionEmailPort decisionEmail) {
    this.applications = applications;
    this.scope = scope;
    this.tenants = tenants;
    this.tenantRepository = tenantRepository;
    this.audit = audit;
    this.actors = actors;
    this.clock = clock;
    this.decisionEmail = decisionEmail;
  }

  @Transactional
  public BusinessApplication approve(UUID id, String slug) {
    scope.enter();
    BusinessApplication application = locked(id);
    if (application.status() == BusinessApplicationStatus.APPROVED) {
      Tenant tenant = tenantRepository.findById(application.approvedTenantId())
          .orElseThrow(() -> new IllegalStateException("Falta el tenant aprobado"));
      if (tenant.slug().equals(slug)) {
        return application;
      }
      throw new BusinessApplicationDecisionConflict("La solicitud ya fue aprobada con otro slug");
    }
    if (application.status() != BusinessApplicationStatus.PENDING || application.contactVerifiedAt() == null) {
      throw new BusinessApplicationDecisionConflict("La solicitud debe estar pendiente y verificada");
    }
    UUID actor = actors.requireUserId();
    Tenant tenant = tenants.register(new RegisterTenantCommand(application.businessName(), slug,
        application.vertical(), application.contactEmail()));
    // CU-25 fija el ámbito del tenant nuevo al persistir su invitación.
    scope.enter();
    BusinessApplication decided = application.approve(actor, tenant.id(), clock.instant());
    applications.saveDecision(decided);
    audit.record(new AuditEvent(UUID.randomUUID(), BusinessApplication.PLATFORM, actor,
        clock.instant(), AuditResourceType.BUSINESS_APPLICATION, id,
        AuditEventType.BUSINESS_APPLICATION_APPROVED,
        Map.of("approvedTenantId", tenant.id().value())));
    notifyAfterCommit(decided);
    return decided;
  }

  @Transactional
  public BusinessApplication reject(UUID id, String reason) {
    scope.enter();
    BusinessApplication application = locked(id);
    String normalized = reason.trim();
    if (application.status() == BusinessApplicationStatus.REJECTED) {
      if (normalized.equals(application.rejectionReason())) {
        return application;
      }
      throw new BusinessApplicationDecisionConflict("La solicitud ya fue rechazada con otro motivo");
    }
    if (application.status() != BusinessApplicationStatus.PENDING) {
      throw new BusinessApplicationDecisionConflict("La solicitud ya fue aprobada");
    }
    UUID actor = actors.requireUserId();
    BusinessApplication decided = application.reject(actor, normalized, clock.instant());
    applications.saveDecision(decided);
    audit.record(new AuditEvent(UUID.randomUUID(), BusinessApplication.PLATFORM, actor,
        clock.instant(), AuditResourceType.BUSINESS_APPLICATION, id,
        AuditEventType.BUSINESS_APPLICATION_REJECTED, Map.of("status", "REJECTED")));
    notifyAfterCommit(decided);
    return decided;
  }

  private void notifyAfterCommit(BusinessApplication decided) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      throw new IllegalStateException("La notificación requiere una transacción activa");
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCommit() {
        decisionEmail.send(decided.contactEmail(), decided.businessName(), decided.status());
      }
    });
  }

  private BusinessApplication locked(UUID id) {
    return applications.findByIdForUpdate(id).orElseThrow(BusinessApplicationNotFound::new);
  }
}
