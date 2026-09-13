package com.mapit.platform.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import com.mapit.platform.application.TenantService;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantRepository;

class TenantControllerTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  private final InMemoryTenantRepository repository = new InMemoryTenantRepository();
  private final LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    validator.afterPropertiesSet();
    TenantService service =
        new TenantService(repository, (tenant, recipient) -> {}, Clock.fixed(NOW, ZoneOffset.UTC));
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
