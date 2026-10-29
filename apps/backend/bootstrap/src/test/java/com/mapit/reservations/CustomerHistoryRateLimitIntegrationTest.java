package com.mapit.reservations;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Límite HTTP por IP de conexión, independiente del email y del tenant inexistente. */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CustomerHistoryRateLimitIntegrationTest {
  private static final String PASSWORD = "history_rate_test";

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> PASSWORD);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> PASSWORD);
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @LocalServerPort int port;

  @Test
  void diezSolicitudesPermitidasYUndecimaRechazadaAunqueCambieCorreoOTenant() {
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    for (int i = 0; i < 10; i++) {
      http.post().uri("/api/v1/public/tenants/unknown-tenant/history-access-requests")
          .body("{\"email\":\"unknown" + i + "@history.test\"}")
          .exchange().expectStatus().isAccepted();
    }
    http.post().uri("/api/v1/public/tenants/demo/history-access-requests")
        .body("{\"email\":\"another@history.test\"}")
        .exchange().expectStatus().isEqualTo(429)
        .expectHeader().contentTypeCompatibleWith("application/problem+json");
    // No se confía en X-Forwarded-For arbitrario para reiniciar el contador.
    http.post().uri("/api/v1/public/tenants/demo/history-access-requests")
        .header("X-Forwarded-For", "203.0.113.7")
        .body("{\"email\":\"another@history.test\"}")
        .exchange().expectStatus().isEqualTo(429);
  }
}
