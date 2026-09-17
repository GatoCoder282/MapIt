package com.mapit.platform.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.mapit.platform.domain.AdminInvitationEmailPort;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.InvitationToken;
import com.mapit.platform.domain.InvitationTokenRepository;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantPage;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.tenant.TenantId;

class TenantServiceTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  @Test
  void registra_un_tenant_y_emite_la_invitacion_del_primer_admin() {
    var repository = new InMemoryTenantRepository();
    var invitations = new InMemoryInvitationRepository();
    var email = new RecordingEmail();
    var service = service(repository, invitations, email);

    Tenant tenant =
        service.register(
            new RegisterTenantCommand(
                "Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "admin@norte.bo"));

    assertThat(tenant.name()).isEqualTo("Empresa Norte");
    assertThat(repository.saved.values()).containsExactly(tenant);

    // La invitación queda persistida con hash, email del admin y caducidad de 24 h.
    assertThat(invitations.saved).hasSize(1);
    InvitationToken invitation = invitations.saved.values().iterator().next();
    assertThat(invitation.tenantId()).isEqualTo(tenant.id());
    assertThat(invitation.email()).isEqualTo("admin@norte.bo");
    assertThat(invitation.tokenHash()).hasSize(64); // SHA-256 en hex
    assertThat(invitation.expiresAt()).isEqualTo(NOW.plusSeconds(24 * 3600));

    // El correo lleva el enlace con el slug del tenant y el token en claro (una vez).
    assertThat(email.recipient).isEqualTo("admin@norte.bo");
    assertThat(email.url).contains("/activar?tenant=empresa-norte&token=");
  }

  @Test
  void no_emite_invitacion_si_el_slug_esta_duplicado() {
    var repository = new InMemoryTenantRepository();
    var invitations = new InMemoryInvitationRepository();
    Tenant existente =
        Tenant.register(TenantId.generate(), "Otra", "empresa-norte", BusinessVertical.HOTEL, NOW);
    repository.save(existente);
    var service = service(repository, invitations, new RecordingEmail());

    assertThatThrownBy(
            () ->
                service.register(
                    new RegisterTenantCommand(
                        "Otra empresa",
                        " empresa-norte ",
                        BusinessVertical.RESTAURANT,
                        "admin@otra.bo")))
        .isInstanceOf(TenantSlugAlreadyExistsException.class);

    assertThat(repository.saved.values()).containsExactly(existente);
    assertThat(invitations.saved).isEmpty();
  }

  @Test
  void informa_el_fallo_de_notificacion() {
    var repository = new InMemoryTenantRepository();
    var service =
        service(repository, new InMemoryInvitationRepository(), new FailingEmail());

    assertThatThrownBy(
            () ->
                service.register(
                    new RegisterTenantCommand(
                        "Empresa Sur", "empresa-sur", BusinessVertical.NIGHTCLUB, "admin@sur.bo")))
        .isInstanceOf(TenantConfirmationEmailException.class);
  }

  @Test
  void edita_solo_los_campos_editables_y_mantiene_slug_y_vertical() {
    var repository = new InMemoryTenantRepository();
    var service = service(repository, new InMemoryInvitationRepository(), new RecordingEmail());
    Tenant original =
        service.register(
            new RegisterTenantCommand(
                "Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "admin@norte.bo"));

    Tenant updated =
        service.update(new UpdateTenantCommand(original.id().value(), "Empresa Norte 2", null));

    assertThat(updated.name()).isEqualTo("Empresa Norte 2");
    assertThat(updated.slug()).isEqualTo("empresa-norte");
    assertThat(updated.vertical()).isEqualTo(BusinessVertical.HOTEL);
    assertThat(updated.status()).isEqualTo(TenantStatus.ACTIVE);
  }

  @Test
  void suspende_y_reactiva_un_tenant() {
    var repository = new InMemoryTenantRepository();
    var service = service(repository, new InMemoryInvitationRepository(), new RecordingEmail());
    Tenant tenant =
        service.register(
            new RegisterTenantCommand(
                "Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "admin@norte.bo"));

    Tenant suspended =
        service.update(new UpdateTenantCommand(tenant.id().value(), null, TenantStatus.SUSPENDED));
    assertThat(suspended.status()).isEqualTo(TenantStatus.SUSPENDED);

    Tenant reactivated =
        service.update(new UpdateTenantCommand(tenant.id().value(), null, TenantStatus.ACTIVE));
    assertThat(reactivated.status()).isEqualTo(TenantStatus.ACTIVE);
  }

  @Test
  void falla_al_editar_o_consultar_un_tenant_inexistente() {
    var service = service(new InMemoryTenantRepository(), new InMemoryInvitationRepository(), new RecordingEmail());

    assertThatThrownBy(() -> service.detail("no-existe"))
        .isInstanceOf(TenantNotFoundException.class);
    assertThatThrownBy(() -> service.update(new UpdateTenantCommand("no-existe", "Nombre", null)))
        .isInstanceOf(TenantNotFoundException.class);
  }

  @Test
  void valida_la_paginacion_del_listado() {
    var service = service(new InMemoryTenantRepository(), new InMemoryInvitationRepository(), new RecordingEmail());

    assertThatThrownBy(() -> service.search(null, null, -1, 20))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.search(null, null, 0, 0))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.search(null, null, 0, 101))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private static TenantService service(
      TenantRepository repository,
      InvitationTokenRepository invitations,
      AdminInvitationEmailPort email) {
    return new TenantService(
        repository, invitations, email, new SecureTokenGenerator(), fixedClock(), "http://localhost:4300");
  }

  private static Clock fixedClock() {
    return Clock.fixed(NOW, ZoneOffset.UTC);
  }

  private static final class InMemoryTenantRepository implements TenantRepository {
    private final Map<String, Tenant> saved = new LinkedHashMap<>();

    @Override
    public boolean existsBySlug(String slug) {
      return saved.values().stream().anyMatch(t -> t.slug().equals(slug));
    }

    @Override
    public Tenant save(Tenant tenant) {
      saved.put(tenant.id().value(), tenant);
      return tenant;
    }

    @Override
    public Optional<Tenant> findById(TenantId id) {
      return Optional.ofNullable(saved.get(id.value()));
    }

    @Override
    public TenantPage search(String search, TenantStatus status, int page, int size) {
      var all = java.util.List.copyOf(saved.values());
      return new TenantPage(all, page, size, all.size(), all.isEmpty() ? 0 : 1);
    }
  }

  private static final class InMemoryInvitationRepository implements InvitationTokenRepository {
    private final Map<java.util.UUID, InvitationToken> saved = new LinkedHashMap<>();

    @Override
    public void save(InvitationToken invitation) {
      saved.put(invitation.id(), invitation);
    }
  }

  private static final class RecordingEmail implements AdminInvitationEmailPort {
    private String recipient;
    private String url;

    @Override
    public void send(Tenant tenant, String email, String activationUrl) {
      this.recipient = email;
      this.url = activationUrl;
    }
  }

  private static final class FailingEmail implements AdminInvitationEmailPort {
    @Override
    public void send(Tenant tenant, String email, String activationUrl) {
      throw new IllegalStateException("SMTP no disponible");
    }
  }
}
