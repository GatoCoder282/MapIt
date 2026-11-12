package com.mapit.identity.application;

import java.security.MessageDigest;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.ActivationExceptions.EmailAlreadyRegistered;
import com.mapit.identity.domain.ActivationExceptions.Expired;
import com.mapit.identity.domain.ActivationExceptions.Invalid;
import com.mapit.identity.domain.ActivationExceptions.PasswordMismatch;
import com.mapit.identity.domain.ActivationExceptions.Used;
import com.mapit.identity.domain.ActivationExceptions.WeakPassword;
import com.mapit.identity.domain.AppUserCreator;
import com.mapit.identity.domain.InvitationTokenStore;
import com.mapit.identity.domain.PasswordHasher;
import com.mapit.identity.domain.StoredInvitation;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;

/**
 * CU-25: activación del primer ADMIN a partir del enlace de invitación.
 * Una sola transacción: validación, consumo atómico del token y creación del
 * usuario ADMIN con su hash BCrypt. Sin tenant_id desde el cliente: el tenant
 * sale del enlace (slug) validado contra la invitación persistida.
 */
@Service
public class ActivateAdmin {

  private final InvitationTokenStore invitations;
  private final AppUserCreator users;
  private final PasswordHasher passwordHasher;
  private final Clock clock;
  private final AuditEventRecorder audit;

  public ActivateAdmin(
      InvitationTokenStore invitations,
      AppUserCreator users,
      PasswordHasher passwordHasher,
      Clock clock,
      AuditEventRecorder audit) {
    this.invitations = invitations;
    this.users = users;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
    this.audit = audit;
  }

  /** Devuelve el email activado; el dominio de errores son las excepciones de CU-25. */
  @Transactional
  public String execute(String tenantId, String token, String password, String passwordConfirm) {
    if (!password.equals(passwordConfirm)) {
      throw new PasswordMismatch();
    }
    String weakness = PasswordPolicy.validate(password);
    if (weakness != null) {
      throw new WeakPassword(weakness);
    }

    // El enlace lleva el SLUG; el tenant real lo resuelve el servidor.
    // Un slug manipulado no ofrece nada: no hay invitación bajo ese tenant.
    TenantId tenant = invitations.findTenantBySlug(tenantId).orElseThrow(Invalid::new);
    if (!invitations.lockActiveTenant(tenant)) throw new Invalid();
    StoredInvitation invitation =
        invitations
            .findByTokenHash(tenant, sha256(token))
            .orElseThrow(Invalid::new);
    if (invitation.isUsed()) {
      throw new Used();
    }
    if (!clock.instant().isBefore(invitation.expiresAt())) {
      throw new Expired();
    }

    UserRole role = switch (invitation.purpose()) {
      case ADMIN_ONBOARDING -> {
        if (invitation.targetRole() != null) throw new Invalid();
        yield UserRole.ADMIN;
      }
      case MEMBER -> {
        if (invitation.targetRole() != UserRole.MANAGER && invitation.targetRole() != UserRole.STAFF) {
          throw new Invalid();
        }
        yield invitation.targetRole();
      }
    };

    // Primero el usuario (la invitación referencia su id); si la creación
    // rebota (email duplicado en el tenant), toda la transacción rueda atrás.
    UUID userId;
    try {
      userId =
          users.create(
              invitation.tenantId(),
              invitation.email(),
              PasswordPolicy.defaultFullName(invitation.email()),
              passwordHasher.hash(password),
               role);
    } catch (org.springframework.dao.DuplicateKeyException duplicate) {
      throw new EmailAlreadyRegistered();
    }

    // Consumo atómico al final: si otro proceso se adelantó, esa utilización
    // gana y esta transacción rueda atrás entera (usuario incluido).
    if (!invitations.markConsumed(tenant, invitation.id(), userId)) {
      throw new Used();
    }
    audit.record(new AuditEvent(UUID.randomUUID(), tenant, userId, clock.instant(),
        AuditResourceType.USER, userId, AuditEventType.USER_INVITATION_ACCEPTED,
        Map.of("invitationId", invitation.id().toString(), "role", role.name())));
    return invitation.email();
  }

  private static String sha256(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
    }
  }
}
