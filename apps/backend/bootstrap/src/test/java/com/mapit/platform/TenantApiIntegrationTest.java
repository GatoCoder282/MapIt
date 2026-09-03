package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.TenantConfirmationEmailPort;

/** Verifica el registro completo contra PostgreSQL y el servidor HTTP. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(TenantApiIntegrationTest.TestSecurityConfiguration.class)
class TenantApiIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void registra_y_persiste_un_tenant_desde_http() {
    String slug = "api-integration-test";
    jdbcTemplate.update("delete from tenant where slug = ?", slug);

    TenantApiRequest request =
        new TenantApiRequest(
            "Empresa API", slug, BusinessVertical.EVENT_HALL, "admin@api-test.bo");

    TenantApiResponse response =
        RestTestClient.bindToServer()
            .baseUrl("http://localhost:" + port)
            .build()
            .post()
            .uri("/api/v1/tenants")
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(TenantApiResponse.class)
            .returnResult()
            .getResponseBody();

    assertThat(response).isNotNull();
    assertThat(response.slug()).isEqualTo(slug);
    assertThat(response.vertical()).isEqualTo(BusinessVertical.EVENT_HALL);
    assertThat(
            jdbcTemplate.queryForObject(
                "select count(*) from tenant where id = ? and slug = ? and vertical = ?",
                Long.class,
                response.id(),
                slug,
                "EVENT_HALL"))
        .isEqualTo(1L);
  }

  @Test
  void rechaza_un_slug_duplicado_con_conflicto() {
    String slug = "api-duplicate-test";
    jdbcTemplate.update("delete from tenant where slug = ?", slug);
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, vertical, status) values (?, ?, ?, ?, ?)",
        "api-duplicate-id",
        "Empresa existente",
        slug,
        "HOTEL",
        "ACTIVE");

    RestTestClient.bindToServer()
        .baseUrl("http://localhost:" + port)
        .build()
        .post()
        .uri("/api/v1/tenants")
        .contentType(MediaType.APPLICATION_JSON)
        .body(
            new TenantApiRequest("Otra empresa", slug, BusinessVertical.HOTEL, "admin@otra.bo"))
        .exchange()
        .expectStatus()
        .isEqualTo(HttpStatus.CONFLICT)
        .expectBody()
        .jsonPath("$.status")
        .isEqualTo(409);

    assertThat(jdbcTemplate.queryForObject("select count(*) from tenant where slug = ?", Long.class, slug))
        .isEqualTo(1L);
  }

  record TenantApiRequest(
      String name, String slug, BusinessVertical vertical, String administratorEmail) {}

  record TenantApiResponse(
      String id,
      String name,
      String slug,
      BusinessVertical vertical,
      String status,
      String createdAt,
      String updatedAt) {}

  @TestConfiguration(proxyBeanMethods = false)
  static class TestSecurityConfiguration {

    @Bean
    @Primary
    TenantConfirmationEmailPort confirmationEmailPort() {
      return (tenant, recipient) -> {};
    }

    @Bean
    @Order(-1)
    SecurityFilterChain tenantTestSecurity(HttpSecurity http) throws Exception {
      return http
          .securityMatcher("/api/v1/tenants")
          .csrf(csrf -> csrf.disable())
          .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
          .build();
    }
  }
}
