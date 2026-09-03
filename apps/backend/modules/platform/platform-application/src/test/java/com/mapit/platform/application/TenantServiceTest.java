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
import com.mapit.platform.domain.TenantRepository;

class TenantServiceTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  @Test
  void registra_un_tenant_y_genera_el_id_en_el_servidor() {
    InMemoryTenantRepository repository = new InMemoryTenantRepository();
    TenantService service = new TenantService(repository, fixedClock());

    Tenant tenant =
        service.register(
            new RegisterTenantCommand("Empresa Norte", "empresa-norte", BusinessVertical.HOTEL));

    assertThat(tenant.name()).isEqualTo("Empresa Norte");
    assertThat(tenant.slug()).isEqualTo("empresa-norte");
    assertThat(tenant.vertical()).isEqualTo(BusinessVertical.HOTEL);
    assertThat(tenant.id()).isNotNull();
    assertThat(repository.saved).containsExactly(tenant);
  }

  @Test
  void rechaza_un_slug_existente_antes_de_persistir() {
    InMemoryTenantRepository repository = new InMemoryTenantRepository();
    repository.slugs.add("empresa-norte");
    TenantService service = new TenantService(repository, fixedClock());

    assertThatThrownBy(
            () ->
                service.register(
                    new RegisterTenantCommand(
                        "Otra empresa", " empresa-norte ", BusinessVertical.RESTAURANT)))
        .isInstanceOf(TenantSlugAlreadyExistsException.class);
    assertThat(repository.saved).isEmpty();
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
}
