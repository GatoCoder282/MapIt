package com.mapit.operations;


import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.ObjectMapper;

/** MAP-224: contrato HTTP, filtros, paginación y autorización de la bitácora. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class AuditLogApiIntegrationTest {

  private static final String TENANT_A = "audit-api-a";
  private static final String TENANT_B = "audit-api-b";
  private static final UUID ADMIN_A = UUID.fromString("22400000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_B = UUID.fromString("22400000-0000-0000-0000-000000000002");
  private static final UUID RESERVATION_A =
      UUID.fromString("22400000-0000-0000-0000-000000000011");
  private static final UUID RESERVATION_B =
      UUID.fromString("22400000-0000-0000-0000-000000000012");
  private static final UUID ELEMENT_A =
      UUID.fromString("22400000-0000-0000-0000-000000000021");
  private static final UUID EVENT_A1 =
      UUID.fromString("22400000-0000-0000-0000-000000000101");
  private static final UUID EVENT_A2 =
      UUID.fromString("22400000-0000-0000-0000-000000000102");
  private static final UUID EVENT_A3 =
      UUID.fromString("22400000-0000-0000-0000-000000000103");
  private static final UUID EVENT_A4 =
      UUID.fromString("22400000-0000-0000-0000-000000000104");
  private static final UUID EVENT_B1 =
      UUID.fromString("22400000-0000-0000-0000-000000000201");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private AccessTokenIssuer tokens;
  @Autowired private ObjectMapper objectMapper;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void fixtures() {
    jdbc.execute("truncate table audit_log");
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);
    tenant(TENANT_A);
    tenant(TENANT_B);
    user(ADMIN_A, TENANT_A, "admin-a@audit-api.test", UserRole.ADMIN);
    user(ADMIN_B, TENANT_B, "admin-b@audit-api.test", UserRole.ADMIN);

    event(
        EVENT_A1,
        TENANT_A,
        ADMIN_A,
        "2026-10-20T10:00:00Z",
        "RESERVATION",
        RESERVATION_A,
        "RESERVATION_CREATED",
        Map.of("status", "CREATED", "establishmentId", UUID.randomUUID().toString()));
    event(
        EVENT_A2,
        TENANT_A,
        ADMIN_A,
        "2026-10-20T11:00:00Z",
        "SPACE_ELEMENT",
        ELEMENT_A,
        "SPACE_ELEMENT_STATE_CHANGED",
        Map.of("previousState", "AVAILABLE", "newState", "RESERVED", "sectorId", UUID.randomUUID().toString()));
    event(
        EVENT_A3,
        TENANT_A,
        ADMIN_A,
        "2026-10-20T12:00:00Z",
        "RESERVATION",
        RESERVATION_B,
        "RESERVATION_CREATED",
        Map.of("status", "CREATED", "establishmentId", UUID.randomUUID().toString()));
    event(
        EVENT_A4,
        TENANT_A,
        ADMIN_A,
        "2026-10-20T13:00:00Z",
        "RESERVATION",
        RESERVATION_A,
        "RESERVATION_STATUS_CHANGED",
        Map.of("previousStatus", "CREATED", "newStatus", "CONFIRMED"));
    event(
        EVENT_B1,
        TENANT_B,
        ADMIN_B,
        "2026-10-20T14:00:00Z",
        "RESERVATION",
        UUID.randomUUID(),
        "RESERVATION_CREATED",
        Map.of("status", "CREATED", "establishmentId", UUID.randomUUID().toString()));
  }

  @Test
  void admin_recibe_su_pagina_en_orden_descendente() {
    http()
        .get()
        .uri("/api/v1/audit-logs")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A, UserRole.ADMIN)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.content.length()")
        .isEqualTo(4)
        .jsonPath("$.content[0].id")
        .isEqualTo(EVENT_A4.toString())
        .jsonPath("$.content[3].id")
        .isEqualTo(EVENT_A1.toString())
        .jsonPath("$.totalElements")
        .isEqualTo(4)
        .jsonPath("$.totalPages")
        .isEqualTo(1)
        .jsonPath("$.page")
        .isEqualTo(0)
        .jsonPath("$.size")
        .isEqualTo(20);
  }

  @Test
  void combina_filtros_de_recurso_evento_identificador_y_fechas() {
    http()
        .get()
        .uri(
            builder ->
                builder
                    .path("/api/v1/audit-logs")
                    .queryParam("resourceType", "RESERVATION")
                    .queryParam("eventType", "RESERVATION_CREATED")
                    .queryParam("resourceId", RESERVATION_A)
                    .queryParam("from", "2026-10-20T09:00:00Z")
                    .queryParam("to", "2026-10-20T10:00:00Z")
                    .build())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A, UserRole.ADMIN)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.content.length()")
        .isEqualTo(1)
        .jsonPath("$.content[0].id")
        .isEqualTo(EVENT_A1.toString())
        .jsonPath("$.content[0].details.status")
        .isEqualTo("CREATED")
        .jsonPath("$.totalElements")
        .isEqualTo(1);
  }

  @Test
  void pagina_con_limite_y_conserva_el_total() {
    http()
        .get()
        .uri("/api/v1/audit-logs?page=1&size=2")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A, UserRole.ADMIN)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.content.length()")
        .isEqualTo(2)
        .jsonPath("$.content[0].id")
        .isEqualTo(EVENT_A2.toString())
        .jsonPath("$.content[1].id")
        .isEqualTo(EVENT_A1.toString())
        .jsonPath("$.page")
        .isEqualTo(1)
        .jsonPath("$.size")
        .isEqualTo(2)
        .jsonPath("$.totalElements")
        .isEqualTo(4)
        .jsonPath("$.totalPages")
        .isEqualTo(2);
  }

  @Test
  void tenant_distinto_no_observa_ni_infiere_eventos_ajenos() {
    http()
        .get()
        .uri("/api/v1/audit-logs")
        .header("Authorization", bearer(token(ADMIN_B, TENANT_B, UserRole.ADMIN)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.content.length()")
        .isEqualTo(1)
        .jsonPath("$.content[0].id")
        .isEqualTo(EVENT_B1.toString())
        .jsonPath("$.totalElements")
        .isEqualTo(1);
  }

  @Test
  void rechaza_consultas_invalidas_con_400() {
    String authorization = bearer(token(ADMIN_A, TENANT_A, UserRole.ADMIN));
    for (String uri :
        new String[] {
          "/api/v1/audit-logs?page=-1",
          "/api/v1/audit-logs?size=0",
          "/api/v1/audit-logs?size=101",
          "/api/v1/audit-logs?resourceType=UNKNOWN",
          "/api/v1/audit-logs?resourceId=not-a-uuid",
          "/api/v1/audit-logs?from=not-a-date",
          "/api/v1/audit-logs?from=2026-10-21T00:00:00Z&to=2026-10-20T00:00:00Z"
        }) {
      http()
          .get()
          .uri(uri)
          .header("Authorization", authorization)
          .exchange()
          .expectStatus()
          .isBadRequest();
    }
  }

  @Test
  void exige_jwt_y_rechaza_todos_los_roles_distintos_de_admin() {
    http().get().uri("/api/v1/audit-logs").exchange().expectStatus().isUnauthorized();

    for (UserRole role :
        new UserRole[] {UserRole.MANAGER, UserRole.STAFF, UserRole.SUPER_ADMIN}) {
      http()
          .get()
          .uri("/api/v1/audit-logs")
          .header("Authorization", bearer(token(UUID.randomUUID(), TENANT_A, role)))
          .exchange()
          .expectStatus()
          .isForbidden();
    }
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UUID userId, String tenantId, UserRole role) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                role.name().toLowerCase() + "@audit-api.test",
                "Integration Tester",
                role))
        .value();
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private void tenant(String id) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        "Empresa " + id,
        id);
  }

  private void user(UUID id, String tenantId, String email, UserRole role) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Integration Tester', ?)",
        id,
        tenantId,
        email,
        role.name());
  }

  private void event(
      UUID id,
      String tenantId,
      UUID actorId,
      String occurredAt,
      String resourceType,
      UUID resourceId,
      String eventType,
      Map<String, String> details) {
    jdbc.update(
        """
        insert into audit_log
          (id, tenant_id, actor_id, occurred_at, resource_type, resource_id, event_type, details)
        values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
        """,
        id,
        tenantId,
        actorId,
        Timestamp.from(Instant.parse(occurredAt)),
        resourceType,
        resourceId,
        eventType,
        objectMapper.writeValueAsString(details));
  }
}
