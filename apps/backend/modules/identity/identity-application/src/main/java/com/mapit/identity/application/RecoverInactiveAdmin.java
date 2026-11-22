package com.mapit.identity.application;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AdminLifecycleRepository;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;
import com.mapit.identity.domain.AdminRecoveryTokenRepository;
import com.mapit.identity.domain.ApprovedAdminRecoveryAuthorization;
import com.mapit.identity.domain.PasswordHasher;
import com.mapit.identity.domain.PasswordVerifier;
import com.mapit.identity.domain.RecoveryApprovalSource;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.invitation.InvitationSecrets;
import com.mapit.shared.tenant.TenantId;

/** Núcleo de rescate: solo invocación interna, sin adaptador HTTP ni comando registrado. */
@Service
public class RecoverInactiveAdmin {
  private final AdminRecoveryActorVerifier actors;
  private final AdminRecoveryAuthorizationRepository authorizations;
  private final AdminLifecycleRepository admins;
  private final AdminRecoveryTokenRepository recoveryTokens;
  private final RecoveryApprovalSource approvalSource;
  private final InvitationSecrets secrets;
  private final PasswordVerifier passwords;
  private final PasswordHasher hasher;
  private final AuditEventRecorder audit;
  private final Clock clock;

  public RecoverInactiveAdmin(AdminRecoveryActorVerifier actors,
      AdminRecoveryAuthorizationRepository authorizations, AdminLifecycleRepository admins,
      AdminRecoveryTokenRepository recoveryTokens, RecoveryApprovalSource approvalSource,
      InvitationSecrets secrets,
      PasswordVerifier passwords, PasswordHasher hasher, AuditEventRecorder audit, Clock clock) {
    this.actors = actors;
    this.authorizations = authorizations;
    this.admins = admins;
    this.recoveryTokens = recoveryTokens;
    this.approvalSource = approvalSource;
    this.secrets = secrets;
    this.passwords = passwords;
    this.hasher = hasher;
    this.audit = audit;
    this.clock = clock;
  }

  /** La contraseña llega solo en memoria desde un canal seguro futuro, nunca por argv/log. */
  @Transactional
  public void execute(String operatorToken, String approverToken, UUID authorizationId,
      String newPassword) {
    validatePassword(newPassword);
    var operator = actors.verify(operatorToken);
    var approver = actors.verify(approverToken);
    if (operator.id().equals(approver.id())
        || !admins.lockPlatformAuthorizers(operator, approver)) {
      throw new SecurityException("Autorización de plataforma no vigente");
    }

    var approved = authorizations.findUsable(authorizationId, clock.instant())
        .orElseThrow(() -> new SecurityException("Autorización de rescate no utilizable"));
    var request = approved.request();
    if (!request.operator().equals(operator.id()) || !approver.id().equals(approved.approverId())) {
      throw new SecurityException("Aprobación fuera de alcance");
    }
    restore(operator.tenantId(), operator.id(), approved, newPassword, approver.id(), null);
  }

  /** Política interna de una sola identidad SUPER_ADMIN y aprobación documental. */
  @Transactional
  public void executeDocumented(String operatorToken, UUID authorizationId,
      String approvalReference, String newPassword) {
    validatePassword(newPassword);
    var operator = actors.verify(operatorToken);
    if (!admins.lockPlatformOperator(operator)) {
      throw new SecurityException("Operador de plataforma no vigente");
    }
    var approved = authorizations.findUsable(authorizationId, clock.instant())
        .orElseThrow(() -> new SecurityException("Autorización de rescate no utilizable"));
    if (!approved.request().operator().equals(operator.id())
        || approved.approverId() != null || approvalReference == null
        || !approvalReference.equals(approved.approvalReference())
        || approved.approvalResponsible().equalsIgnoreCase(operator.id().toString())) {
      throw new SecurityException("Aprobación documental fuera de alcance");
    }
    restore(operator.tenantId(), operator.id(), approved, newPassword, null, approvalReference);
  }

  /** El titular presenta el token; ningún dato de operador, usuario o rol viene del request. */
  @Transactional
  public String executeByToken(String tenantSlug, String rawToken, String newPassword,
      String confirmation) {
    if (rawToken == null || !rawToken.startsWith("recover.")
        || rawToken.length() < 40 || rawToken.length() > 200
        || newPassword == null || !newPassword.equals(confirmation)) {
      throw new SecurityException("Enlace de recuperación inválido");
    }
    validatePassword(newPassword);
    String tokenHash = secrets.hash(rawToken);
    UUID authorizationId = recoveryTokens.lockUsable(tokenHash, clock.instant())
        .orElseThrow(() -> new SecurityException("Enlace de recuperación inválido"));
    var approved = authorizations.findUsable(authorizationId, clock.instant())
        .orElseThrow(() -> new SecurityException("Autorización no utilizable"));
    var request = approved.request();
    if (approved.approverId() != null || approved.approvalReference() == null
        || !request.targetSlug().equals(tenantSlug)
        || approvalSource.isRevokedIfRegistered(approved.approvalReference())
        || !admins.lockPlatformOperator(request.operator())) {
      throw new SecurityException("Recuperación fuera de alcance");
    }
    String email = restore(TenantId.of("platform"), request.operator(), approved,
        newPassword, null, approved.approvalReference());
    if (!recoveryTokens.consume(tokenHash, clock.instant())) {
      throw new IllegalStateException("Enlace ya utilizado");
    }
    return email;
  }

  private String restore(TenantId operatorTenant, UUID operatorId,
      ApprovedAdminRecoveryAuthorization approved, String newPassword,
      UUID approverId, String approvalReference) {
    var request = approved.request();
    var tenant = request.targetTenant();
    UUID target = request.targetUser();
    if (!admins.lockRecoveryTenant(tenant, request.targetSlug())
        || !admins.lockInactiveAdmin(tenant, target) || admins.activeAdmins(tenant) != 0) {
      throw new IllegalStateException("ADMIN no elegible para recuperación");
    }
    String email = admins.inactiveAdminEmail(tenant, target)
        .orElseThrow(() -> new IllegalStateException("ADMIN destinatario no disponible"));
    var oldHash = admins.inactiveAdminPasswordHash(tenant, target)
        .orElseThrow(() -> new IllegalStateException("Credencial anterior no disponible"));
    if (passwords.matches(newPassword, java.util.Optional.of(oldHash))) {
      throw new IllegalArgumentException("La contraseña nueva debe ser distinta");
    }

    var cutoff = clock.instant();
    if (!admins.recoverInactiveAdmin(tenant, target, hasher.hash(newPassword), cutoff)) {
      throw new IllegalStateException("ADMIN cambió concurrentemente");
    }
    boolean consumed = approverId != null
        ? authorizations.consume(request.id(), operatorId, approverId, cutoff)
        : authorizations.consumeDocumentApproval(request.id(), operatorId, approvalReference, cutoff);
    if (!consumed) {
      throw new IllegalStateException("Aprobación cambió concurrentemente");
    }
    String reason = request.reason().substring(0, Math.min(request.reason().length(), 200));
    audit.record(new AuditEvent(UUID.randomUUID(), operatorTenant, operatorId,
        clock.instant(), AuditResourceType.USER, target, AuditEventType.USER_RECOVERED,
        Map.of("targetTenantId", tenant.value(), "ticket", request.ticket(), "reason", reason)));
    return email;
  }

  private static void validatePassword(String newPassword) {
    String weakness = PasswordPolicy.validate(newPassword);
    if (weakness != null
        || newPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
      throw new IllegalArgumentException("Contraseña nueva inválida");
    }
  }
}
