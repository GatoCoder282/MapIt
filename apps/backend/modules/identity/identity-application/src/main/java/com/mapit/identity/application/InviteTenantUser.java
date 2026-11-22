package com.mapit.identity.application;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.InvitationTokenStore;
import com.mapit.identity.domain.MemberInvitation;
import com.mapit.identity.domain.MemberInvitationDelivery;
import com.mapit.identity.domain.MemberInvitationRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.invitation.InvitationSecrets;
import com.mapit.shared.tenant.TenantId;

/** Emisión y reenvío MEMBER; usa la tabla y el generador existentes de CU-25. */
@Service
public class InviteTenantUser {
  private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);
  private final ManageTenantUsers users;
  private final InvitationTokenStore tokens;
  private final MemberInvitationRepository invitations;
  private final InvitationSecrets secrets;
  private final MemberInvitationDelivery delivery;
  private final AuditEventRecorder audit;
  private final Clock clock;
  private final String publicUrl;

  public InviteTenantUser(ManageTenantUsers users, InvitationTokenStore tokens,
      MemberInvitationRepository invitations, InvitationSecrets secrets,
      MemberInvitationDelivery delivery, AuditEventRecorder audit, Clock clock,
      @org.springframework.beans.factory.annotation.Value("${mapit.public-web-url:http://localhost:4300}") String publicUrl) {
    this.users = users;
    this.tokens = tokens;
    this.invitations = invitations;
    this.secrets = secrets;
    this.delivery = delivery;
    this.audit = audit;
    this.clock = clock;
    this.publicUrl = publicUrl;
  }

  @Transactional
  public Receipt issue(AuthenticatedPrincipal actor, String suppliedEmail, UserRole role) {
    TenantId tenant = requireTenant(actor);
    String email = normalize(suppliedEmail);
    if (!tokens.lockActiveTenant(tenant)) throw new ManageTenantUsers.Unauthenticated("Tenant no vigente.");
    users.authorizeInvitation(actor, role);
    if (invitations.userExists(tenant, email)) throw new ManageTenantUsers.Conflict("Cuenta ya registrada.");
    invitations.pending(tenant, email).ifPresent(pending -> {
      if (clock.instant().isBefore(pending.expiresAt())) throw new ManageTenantUsers.Conflict("Invitación pendiente.");
      if (!invitations.revoke(tenant, pending.id())) throw new ManageTenantUsers.Conflict("La invitación cambió.");
    });
    return create(actor, email, role);
  }

  @Transactional
  public Receipt resend(AuthenticatedPrincipal actor, UUID oldId) {
    TenantId tenant = requireTenant(actor);
    if (!tokens.lockActiveTenant(tenant)) throw new ManageTenantUsers.Unauthenticated("Tenant no vigente.");
    users.authorizeResend(actor);
    MemberInvitation old = invitations.byId(tenant, oldId)
        .orElseThrow(() -> new ManageTenantUsers.NotFound("Invitación no encontrada."));
    if (!old.pending()) throw new ManageTenantUsers.Conflict("Invitación no pendiente.");
    // Un intento SMTP aceptado o ambiguo puede seguir entregando correo.
    // La autenticación SMTP fallida permite corrección/reintento inmediato.
    if (!"SMTP_FAILED".equals(old.dispatchStatus()) && old.dispatchAttemptedAt() != null
        && clock.instant().isBefore(old.dispatchAttemptedAt().plus(RESEND_COOLDOWN))) {
      throw new ManageTenantUsers.Conflict("Reenvío demasiado frecuente.");
    }
    if (invitations.userExists(tenant, old.email())) throw new ManageTenantUsers.Conflict("Cuenta ya registrada.");
    if (!invitations.revoke(tenant, oldId)) throw new ManageTenantUsers.Conflict("La invitación cambió.");
    return create(actor, old.email(), old.role());
  }

  /** Solo las filas que el endpoint de reenvío aún puede reemplazar, incluidas caducadas. */
  @Transactional(readOnly = true)
  public Page list(AuthenticatedPrincipal actor, int page, int size) {
    if (page < 0 || size < 1 || size > 100) throw new ManageTenantUsers.BadRequest("Paginación inválida.");
    TenantId tenant = requireTenant(actor);
    users.authorizeResend(actor);
    long total = invitations.countRecoverable(tenant);
    List<MemberInvitation> content = invitations.listRecoverable(tenant, size, (long) page * size);
    return new Page(content, page, size, total, Math.toIntExact(Math.ceilDiv(total, (long) size)), clock.instant());
  }

  public record Page(List<MemberInvitation> content, int page, int size, long totalElements,
      int totalPages, java.time.Instant asOf) {}

  private Receipt create(AuthenticatedPrincipal actor, String email, UserRole role) {
    String raw = secrets.newToken();
    UUID id = UUID.randomUUID();
    MemberInvitation created;
    try {
      created = invitations.insert(actor.tenantId(), id, email, role, actor.id(), secrets.hash(raw));
    } catch (DuplicateKeyException duplicate) {
      throw new ManageTenantUsers.Conflict("Cuenta o invitación ya existente.");
    }
    audit.record(new AuditEvent(UUID.randomUUID(), actor.tenantId(), actor.id(), clock.instant(),
        AuditResourceType.USER_INVITATION, id, AuditEventType.USER_INVITATION_ISSUED,
        Map.of("targetRole", role.name())));
    var info = invitations.tenantInfo(actor.tenantId());
    Receipt receipt = new Receipt(created.id(), email, role, created.expiresAt());
    String url = publicUrl + "/activar?tenant=" + info.slug() + "&token=" + raw;
    // El secreto existe únicamente en esta callback efímera. Nunca enviarlo antes del COMMIT.
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override public void afterCommit() {
        receipt.dispatchStatus.set(delivery.deliver(actor.tenantId(), id, info.name(), email, url));
      }
    });
    return receipt;
  }

  private static TenantId requireTenant(AuthenticatedPrincipal actor) {
    if (actor == null || "platform".equals(actor.tenantId().value())) {
      throw new ManageTenantUsers.Forbidden("Solo ADMIN del tenant puede invitar.");
    }
    return actor.tenantId();
  }

  private static String normalize(String supplied) {
    if (supplied == null) throw new ManageTenantUsers.BadRequest("Correo inválido.");
    String email = supplied.strip().toLowerCase(Locale.ROOT);
    if (email.isEmpty() || email.length() > 254 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
      throw new ManageTenantUsers.BadRequest("Correo inválido.");
    }
    return email;
  }

  public static final class Receipt {
    private final UUID id;
    private final String email;
    private final UserRole role;
    private final java.time.Instant expiresAt;
    private final AtomicReference<MemberInvitationDelivery.Status> dispatchStatus =
        new AtomicReference<>(MemberInvitationDelivery.Status.SEND_REQUESTED);

    private Receipt(UUID id, String email, UserRole role, java.time.Instant expiresAt) {
      this.id = id;
      this.email = email;
      this.role = role;
      this.expiresAt = expiresAt;
    }

    public UUID id() { return id; }
    public String email() { return email; }
    public UserRole role() { return role; }
    public java.time.Instant expiresAt() { return expiresAt; }
    public MemberInvitationDelivery.Status dispatchStatus() { return dispatchStatus.get(); }
  }
}
