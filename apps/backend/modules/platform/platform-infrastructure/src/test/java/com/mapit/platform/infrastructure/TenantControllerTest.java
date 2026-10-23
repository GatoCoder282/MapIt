package com.mapit.platform.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import com.mapit.platform.application.RegisterTenantCommand;
import com.mapit.platform.application.SecureTokenGenerator;
import com.mapit.platform.application.TenantService;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantPage;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.tenant.TenantId;

class TenantControllerTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  private final InMemoryTenantRepository repository = new InMemoryTenantRepository();
  private final LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
  private TenantService service;
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    validator.afterPropertiesSet();
    service =
        new TenantService(
            repository,
            invitation -> {}, // InvitationTokenRepository sin efecto en este test
            (tenant, email, url) -> {},
            new SecureTokenGenerator(),
            Clock.fixed(NOW, ZoneOffset.UTC),
            "http://localhost:4300");
    client =
        RestTestClient.bindToController(new TenantController(service))
            .configureServer(builder -> builder.setValidator(validator))
            .build();
  }

  @AfterEach
  void tearDown() {
    validator.destroy();
  }

  @Test
  void crea_un_tenant_con_una_solicitud_valida() {
    TenantController.TenantRequest request =
        new TenantController.TenantRequest(
            "Empresa Norte", "empresa-norte", BusinessVertical.RESTAURANT, "admin@norte.bo");

    TenantController.TenantResponse response =
        client
            .post()
            .uri("/api/v1/tenants")
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(TenantController.TenantResponse.class)
            .returnResult()
            .getResponseBody();

    assertThat(response).isNotNull();
    assertThat(response.name()).isEqualTo("Empresa Norte");
    assertThat(response.slug()).isEqualTo("empresa-norte");
    assertThat(response.vertical()).isEqualTo(BusinessVertical.RESTAURANT);
    assertThat(repository.saved).hasSize(1);
  }

  @Test
  void lista_tenants_paginados() {
    service.register(new RegisterTenantCommand("Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "a@n.bo"));
    service.register(new RegisterTenantCommand("Empresa Sur", "empresa-sur", BusinessVertical.HOTEL, "b@s.bo"));

    TenantController.TenantPageResponse page =
        client.get().uri("/api/v1/tenants?page=0&size=10").exchange()
            .expectStatus().isOk()
            .expectBody(TenantController.TenantPageResponse.class)
            .returnResult().getResponseBody();

    assertThat(page).isNotNull();
    assertThat(page.content()).hasSize(2);
    assertThat(page.totalElements()).isEqualTo(2);
  }

  @Test
  void devuelve_el_detalle_y_404_si_no_existe() {
    Tenant tenant =
        service.register(new RegisterTenantCommand("Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "a@n.bo"));

    client.get().uri("/api/v1/tenants/" + tenant.id().value()).exchange().expectStatus().isOk();
    client.get().uri("/api/v1/tenants/no-existe").exchange().expectStatus().isNotFound();
  }

  @Test
  void edita_el_nombre_y_suspende_por_patch() {
    Tenant tenant =
        service.register(new RegisterTenantCommand("Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "a@n.bo"));

    TenantController.TenantResponse updated =
        client.patch().uri("/api/v1/tenants/" + tenant.id().value())
            .contentType(MediaType.APPLICATION_JSON)
            .body(new TenantController.TenantUpdateRequest("Empresa Norte 2", TenantStatus.SUSPENDED))
            .exchange()
            .expectStatus().isOk()
            .expectBody(TenantController.TenantResponse.class)
            .returnResult().getResponseBody();

    assertThat(updated).isNotNull();
    assertThat(updated.name()).isEqualTo("Empresa Norte 2");
    assertThat(updated.status()).isEqualTo(TenantStatus.SUSPENDED);
    assertThat(updated.slug()).isEqualTo("empresa-norte");
  }

  @Test
  void rechaza_un_patch_con_nombre_vacio() {
    Tenant tenant =
        service.register(new RegisterTenantCommand("Empresa Norte", "empresa-norte", BusinessVertical.HOTEL, "a@n.bo"));

    client.patch().uri("/api/v1/tenants/" + tenant.id().value())
        .contentType(MediaType.APPLICATION_JSON)
        .body(new TenantController.TenantUpdateRequest("", null))
        .exchange()
        .expectStatus().isBadRequest();
  }

  @Test
  void rechaza_una_solicitud_con_datos_invalidos() {
    TenantController.TenantRequest request =
        new TenantController.TenantRequest(
            "", "Slug inválido", BusinessVertical.HOTEL, "correo-invalido");

    client
        .post()
        .uri("/api/v1/tenants")
        .contentType(MediaType.APPLICATION_JSON)
        .body(request)
        .exchange()
        .expectStatus()
        .isBadRequest();

    assertThat(repository.saved).isEmpty();
  }

  private static final class InMemoryTenantRepository implements TenantRepository {
    private final Set<String> slugs = new HashSet<>();
    private final Map<String, Tenant> saved = new LinkedHashMap<>();

    @Override
    public boolean existsBySlug(String slug) {
      return slugs.contains(slug);
    }

    @Override
    public Tenant save(Tenant tenant) {
      slugs.add(tenant.slug());
      saved.put(tenant.id().value(), tenant);
      return tenant;
    }

    @Override
    public Optional<Tenant> findById(TenantId id) {
      return Optional.ofNullable(saved.get(id.value()));
    }

    @Override
    public TenantPage search(String search, TenantStatus status, int page, int size) {
      List<Tenant> all = List.copyOf(saved.values());
      return new TenantPage(all, page, size, all.size(), all.isEmpty() ? 0 : 1);
    }
  }
}
