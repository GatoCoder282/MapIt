package com.mapit.config.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.json.JsonMapper;

@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "logging.level.com.mapit=DEBUG")
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
@Import(LoggingHttpIntegrationTest.Probe.class)
class LoggingHttpIntegrationTest {
  @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
      .withDatabaseName("mapit_logging").withUsername("mapit").withPassword("test_password");
  @LocalServerPort int port;
  @Autowired AccessTokenIssuer tokens;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  @Test
  void realServerPreservesStatusesExposesCorsAndEmitsSafeJson(CapturedOutput output) {
    String token = tokens.issue(new AuthenticatedUser(UUID.randomUUID(), TenantId.of("demo"),
        "private-canary@example.test", "Private canary", UserRole.STAFF)).value();
    for (int status : List.of(200, 400, 500)) {
      String id = UUID.randomUUID().toString();
      client().get().uri("/api/v1/logging-probe/" + status + "?token=private-canary")
          .header("Authorization", "Bearer " + token)
          .header("Origin", "http://localhost:4200")
          .header("X-Request-ID", id.toUpperCase())
          .exchange().expectStatus().isEqualTo(status)
          .expectHeader().valueEquals("X-Request-ID", id)
          .expectHeader().valueEquals("Access-Control-Expose-Headers", "X-Request-ID");
      assertThat(output.getAll()).contains(id);
    }
    client().get().uri("/api/v1/tenants").header("Authorization", "Bearer " + token)
        .exchange().expectStatus().isForbidden().expectHeader().exists("X-Request-ID");
    client().get().uri("/api/v1/tenants").header("X-Request-ID", "private-canary")
        .exchange().expectStatus().isUnauthorized().expectHeader()
        .valueMatches("X-Request-ID", "[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}");
    var records = output.getAll().lines().filter(line -> line.startsWith("{"))
        .map(line -> JsonMapper.builder().build().readTree(line)).toList();
    assertThat(records.stream().filter(node -> node.path("event").asString().equals("http.request.failed"))).hasSize(1);
    assertThat(records.stream().filter(node -> node.path("event").asString().equals("http.request.completed"))).hasSize(5);
    assertThat(output.getAll()).doesNotContain("private-canary", token);
  }

  /** Only registered in this test; no failure endpoints ship in the application. */
  @RestController
  @TestConfiguration(proxyBeanMethods = false)
  static class Probe {
    @Bean
    FeatureFlagPort testFlags() {
      return new FeatureFlagPort() {
        @Override public boolean isEnabled(FeatureFlag flag) { return false; }
        @Override public boolean isEnabled(FeatureFlag flag, boolean defaultValue) { return false; }
      };
    }
    @GetMapping("/api/v1/logging-probe/{status}")
    String probe(@PathVariable int status) {
      if (status == 400) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "private-canary");
      if (status == 500) throw new IllegalStateException("private-canary", new RuntimeException("private-canary"));
      return "ok";
    }
  }
}
