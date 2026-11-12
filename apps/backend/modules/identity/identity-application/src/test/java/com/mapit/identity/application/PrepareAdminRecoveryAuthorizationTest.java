package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;
import com.mapit.identity.domain.ApprovedAdminRecoveryAuthorization;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class PrepareAdminRecoveryAuthorizationTest {
  private static final Instant NOW = Instant.parse("2026-11-10T12:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
  private final UUID operatorId = UUID.randomUUID();
  private final UUID approverId = UUID.randomUUID();
  private final FakeRepository repository = new FakeRepository();

  @Test
  void exige_dos_super_admin_distintos_y_vigentes() {
    var service = service(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN, true);
    assertThat(service.approve("operator", "approver", UUID.randomUUID())).isTrue();
    assertThat(repository.approver).isEqualTo(approverId);
    assertThatThrownBy(() -> service.approve("operator", "operator", UUID.randomUUID()))
        .isInstanceOf(SecurityException.class);
  }

  @Test
  void falla_cerrado_con_rol_revocado_o_token_invalido() {
    assertThatThrownBy(() -> service(UserRole.STAFF, UserRole.SUPER_ADMIN, true)
        .approve("operator", "approver", UUID.randomUUID())).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> service(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN, false)
        .approve("operator", "approver", UUID.randomUUID())).isInstanceOf(SecurityException.class);
    assertThat(repository.approver).isNull();
  }

  @Test
  void solicitud_no_admite_operador_suplantado_ni_ventana_vencida() {
    var service = service(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN, true);
    var request = new AdminRecoveryAuthorization(UUID.randomUUID(), TenantId.of("tenant-a"),
        "tenant-a", UUID.randomUUID(), UUID.randomUUID(), "MAP-238", "Sin ADMIN activo",
        NOW.minusSeconds(10), NOW.plusSeconds(100));
    assertThatThrownBy(() -> service.createPending("operator", request))
        .isInstanceOf(SecurityException.class);
    assertThat(repository.created).isNull();
    var expired = new AdminRecoveryAuthorization(UUID.randomUUID(), TenantId.of("tenant-a"),
        "tenant-a", UUID.randomUUID(), operatorId, "MAP-238", "Sin ADMIN activo",
        NOW.minusSeconds(100), NOW);
    assertThatThrownBy(() -> service.createPending("operator", expired))
        .isInstanceOf(SecurityException.class);
  }

  @Test
  void aprobacion_documental_exige_operador_vigente_y_referencia_identificable() {
    var service = service(UserRole.SUPER_ADMIN, UserRole.STAFF, true);
    assertThat(service.recordDocumentApproval("operator", UUID.randomUUID(),
        "MAP-238#acta-1", "responsable-funcional")).isTrue();
    assertThat(repository.reference).isEqualTo("MAP-238#acta-1");
    assertThatThrownBy(() -> service.recordDocumentApproval("operator", UUID.randomUUID(),
        " ", "responsable-funcional")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.recordDocumentApproval("operator", UUID.randomUUID(),
        "MAP-238#acta-1", operatorId.toString())).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service(UserRole.STAFF, UserRole.STAFF, true)
        .recordDocumentApproval("operator", UUID.randomUUID(), "MAP-238#acta-1", "responsable"))
        .isInstanceOf(SecurityException.class);
  }

  private PrepareAdminRecoveryAuthorization service(UserRole operatorRole, UserRole approverRole,
      boolean active) {
    var verifier = new AdminRecoveryActorVerifier(token -> {
      if ("operator".equals(token)) return Optional.of(principal(operatorId, UserRole.SUPER_ADMIN));
      if ("approver".equals(token)) return Optional.of(principal(approverId, UserRole.SUPER_ADMIN));
      return Optional.empty();
    }, signed -> {
      if (!active) return Optional.empty();
      return Optional.of(principal(signed.id(), signed.id().equals(operatorId)
          ? operatorRole : approverRole));
    });
    return new PrepareAdminRecoveryAuthorization(verifier, repository, CLOCK);
  }

  private static AuthenticatedPrincipal principal(UUID id, UserRole role) {
    return new AuthenticatedPrincipal(id, TenantId.of("platform"), "staff@example.test", role);
  }

  private static final class FakeRepository implements AdminRecoveryAuthorizationRepository {
    UUID approver;
    String reference;
    AdminRecoveryAuthorization created;

    public void createPending(AdminRecoveryAuthorization request) { created = request; }
    public boolean approve(UUID requestId, UUID operator, UUID approvedBy, Instant at) {
      approver = approvedBy;
      return true;
    }
    public boolean recordDocumentApproval(UUID requestId, UUID operator, String reference,
        String responsible, Instant at) { this.reference = reference; return true; }
    public boolean revoke(UUID requestId, Instant at) { return false; }
    public boolean consume(UUID requestId, UUID operatorId, UUID approverId, Instant at) {
      return false;
    }
    public boolean consumeDocumentApproval(UUID requestId, UUID operatorId, String reference,
        Instant at) { return false; }
    public Optional<ApprovedAdminRecoveryAuthorization> findUsable(UUID requestId, Instant at) {
      return Optional.empty();
    }
  }
}
