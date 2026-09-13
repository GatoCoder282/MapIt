package com.mapit.platform.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantConfirmationEmailPort;
import com.mapit.platform.domain.TenantRepository;

class TenantServiceTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  @Test
  void registra_un_tenant_y_genera_el_id_en_el_servidor() {
    InMemoryTenantRepository repository = new InMemoryTenantRepository();
    RecordingEmail confirmationEmail = new RecordingEmail();
    TenantService service = new TenantService(repository, confirmationEmail, fixedClock());

    Tenant tenant =
        service.register(
            new RegisterTenantCommand(
                "Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "admin@norte.bo"));

    assertThat(tenant.name()).isEqualTo("Empresa Norte");
    assertThat(tenant.slug()).isEqualTo("empresa-norte");
    assertThat(tenant.vertical()).isEqualTo(BusinessVertical.HOTEL);
    assertThat(tenant.id()).isNotNull();
    assertThat(repository.saved).containsExactly(tenant);
    assertThat(confirmationEmail.tenant).isEqualTo(tenant);
    assertThat(confirmationEmail.recipient).isEqualTo("admin@norte.bo");
  }

  @Test
  void rechaza_un_slug_existente_antes_de_persistir() {
    InMemoryTenantRepository repository = new InMemoryTenantRepository();
    repository.slugs.add("empresa-norte");
    TenantService service = new TenantService(repository, new RecordingEmail(), fixedClock());

    assertThatThrownBy(
            () ->
                service.register(
                    new RegisterTenantCommand(
                        "Otra empresa",
                        " empresa-norte ",
                        BusinessVertical.RESTAURANT,
                        "admin@otra.bo")))
        .isInstanceOf(TenantSlugAlreadyExistsException.class);
    assertThat(repository.saved).isEmpty();
  }

  @Test
  void informa_el_fallo_de_notificacion() {
    InMemoryTenantRepository repository = new InMemoryTenantRepository();
    TenantService service = new TenantService(repository, new FailingEmail(), fixedClock());

    assertThatThrownBy(
            () ->
                service.register(
                    new RegisterTenantCommand(
                        "Empresa Sur", "empresa-sur", BusinessVertical.NIGHTCLUB, "admin@sur.bo")))
        .isInstanceOf(TenantConfirmationEmailException.class);
  }

  private static Clock fixedClock() {
    return Clock.fixed(NOW, ZoneOffset.UTC);
  }

  private static final class InMemoryTenantRepository implements TenantRepository {
    private final Set<String> slugs = new HashSet<>();
    private final Set<Tenant> saved = new HashSet<>();

    @Override
    public boolean existsBySlug(String slug) {
      return slugs.contains(slug);
    }

    @Override
    public Tenant save(Tenant tenant) {
      slugs.add(tenant.slug());
      saved.add(tenant);
      return tenant;
    }
  }

  private static final class RecordingEmail implements TenantConfirmationEmailPort {
    private Tenant tenant;
    private String recipient;

    @Override
    public void send(Tenant tenant, String recipient) {
      this.tenant = tenant;
      this.recipient = recipient;
    }
  }

  private static final class FailingEmail implements TenantConfirmationEmailPort {
    @Override
    public void send(Tenant tenant, String recipient) {
      throw new IllegalStateException("SMTP no disponible");
    }
  }
}
