package com.mapit.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AdminLifecycleRepository;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;
import com.mapit.identity.domain.AdminRecoveryMail;
import com.mapit.identity.domain.AdminRecoveryTokenRepository;
import com.mapit.shared.invitation.InvitationSecrets;

/** Emite un único enlace al correo ya registrado, sin exponer el secreto al ejecutor. */
@Service
public class IssueAdminRecoveryToken {
  private final AdminRecoveryActorVerifier actors;
  private final AdminRecoveryAuthorizationRepository authorizations;
  private final AdminLifecycleRepository admins;
  private final AdminRecoveryTokenRepository tokens;
  private final AdminRecoveryMail mail;
  private final InvitationSecrets secrets;
  private final Clock clock;

  public IssueAdminRecoveryToken(AdminRecoveryActorVerifier actors,
      AdminRecoveryAuthorizationRepository authorizations, AdminLifecycleRepository admins,
      AdminRecoveryTokenRepository tokens, AdminRecoveryMail mail, InvitationSecrets secrets,
      Clock clock) {
    this.actors = actors;
    this.authorizations = authorizations;
    this.admins = admins;
    this.tokens = tokens;
    this.mail = mail;
    this.secrets = secrets;
    this.clock = clock;
  }

  @Transactional
  public void execute(String operatorToken, UUID authorizationId) {
    var operator = actors.verify(operatorToken);
    if (!admins.lockPlatformOperator(operator)) {
      throw new SecurityException("Operador de plataforma no vigente");
    }
    var approved = authorizations.findUsable(authorizationId, clock.instant())
        .orElseThrow(() -> new SecurityException("Autorización no utilizable"));
    var request = approved.request();
    if (!request.operator().equals(operator.id()) || approved.approverId() != null
        || approved.approvalReference() == null
        || !admins.lockRecoveryTenant(request.targetTenant(), request.targetSlug())
        || !admins.lockInactiveAdmin(request.targetTenant(), request.targetUser())
        || admins.activeAdmins(request.targetTenant()) != 0) {
      throw new SecurityException("Rescate fuera de alcance");
    }
    String email = admins.inactiveAdminEmail(request.targetTenant(), request.targetUser())
        .orElseThrow(() -> new SecurityException("Destinatario no disponible"));
    String raw = "recover." + secrets.newToken();
    var expiresAt = clock.instant().plus(Duration.ofMinutes(15));
    if (expiresAt.isAfter(request.expiresAt())) expiresAt = request.expiresAt();
    tokens.issue(authorizationId, secrets.hash(raw), expiresAt);
    // Fallo SMTP revierte la emisión. Nunca devuelve ni registra el token claro.
    mail.send(email, request.targetSlug(), raw);
  }
}
