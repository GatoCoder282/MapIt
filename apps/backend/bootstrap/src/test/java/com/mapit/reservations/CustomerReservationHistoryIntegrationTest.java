package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.reservations.application.history.HistorySecrets;
import com.mapit.reservations.domain.history.CustomerHistoryAccessRepository;
import com.mapit.reservations.domain.history.CustomerHistoryMail;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class CustomerReservationHistoryIntegrationTest {
  private static final String PASSWORD = "history_app_test";
  private static final TenantId A = TenantId.of("history-access-a");
  private static final TenantId B = TenantId.of("history-access-b");
  private static final UUID PERSON_A = UUID.fromString("93000000-0000-0000-0000-000000000001");
  private static final UUID PERSON_B = UUID.fromString("93000000-0000-0000-0000-000000000002");
  private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");

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
    // Los escenarios HTTP comparten el mismo origen loopback; el umbral 10/15 se comprueba
    // aisladamente en HistoryIpLimiterTest para no acoplar los tests entre sí.
    registry.add("mapit.customer-history.ip-limit", () -> "1000");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired TransactionTemplate transactions;
  @Autowired CustomerHistoryAccessRepository access;
  @Autowired HistorySecrets secrets;
  @Autowired AccessTokenIssuer staffTokens;
  @LocalServerPort int port;
  @MockitoBean CustomerHistoryMail mail;

  @BeforeEach
  void fixtures() {
    for (TenantId tenant : new TenantId[] {A, B}) {
      scoped(tenant, () -> {
        jdbc.update("delete from reservation_space_element where tenant_id = ?", tenant.value());
        jdbc.update("delete from reservation where tenant_id = ?", tenant.value());
        jdbc.update("delete from customer_history_access where tenant_id = ?", tenant.value());
        jdbc.update("delete from person where tenant_id = ?", tenant.value());
        jdbc.update("delete from space_element where tenant_id = ?", tenant.value());
        jdbc.update("delete from sector where tenant_id = ?", tenant.value());
        jdbc.update("delete from floor where tenant_id = ?", tenant.value());
        jdbc.update("delete from establishment where tenant_id = ?", tenant.value());
        jdbc.update("delete from app_user where tenant_id = ?", tenant.value());
      });
      jdbc.update("delete from tenant where id = ?", tenant.value());
      jdbc.update("insert into tenant (id, name, slug, vertical) values (?, ?, ?, 'RESTAURANT')",
          tenant.value(), tenant.value(), tenant.value());
    }
    scoped(A, () -> jdbc.update("insert into person (id, tenant_id, full_name, email) values (?, ?, 'A', 'a@history.test')", PERSON_A, A.value()));
    scoped(B, () -> jdbc.update("insert into person (id, tenant_id, full_name, email) values (?, ?, 'B', 'b@history.test')", PERSON_B, B.value()));
  }

  @Test
  void creaExpiraCanjeaUnaVezYRevoca() {
    scoped(A, () -> access.issue(A, PERSON_A, "link-a", NOW.plusSeconds(900), NOW));
    assertThat(exchange(A, "link-a", "session-a", NOW))
        .contains(PERSON_A);
    assertThat(exchange(A, "link-a", "session-2", NOW))
        .isEmpty();
    assertThat(session(A, "session-a", NOW)).contains(PERSON_A);
    assertThat(session(A, "session-a", NOW.plusSeconds(1800))).isEmpty();
    boolean revoked = Boolean.TRUE.equals(transactions.execute(status -> access.revoke(A, "session-a", NOW)));
    assertThat(revoked).isTrue();
    assertThat(session(A, "session-a", NOW)).isEmpty();
    scoped(A, () -> assertThat(jdbc.queryForObject("select session_hash from customer_history_access where link_hash = 'link-a'", String.class)).isNull());
    scoped(A, () -> access.issue(A, PERSON_A, "expired", NOW, NOW.minusSeconds(900)));
    assertThat(exchange(A, "expired", "never", NOW)).isEmpty();
  }

  @Test
  void rlsFallaCerradaYNoCruzaTenants() {
    assertThat(jdbc.queryForObject("select rolbypassrls from pg_roles where rolname = current_user", Boolean.class))
        .isFalse();
    scoped(A, () -> access.issue(A, PERSON_A, "isolated", NOW.plusSeconds(900), NOW));
    assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isZero();
    assertThat(exchange(B, "isolated", "cross", NOW)).isEmpty();
    scoped(B, () -> assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isZero());
    scoped(A, () -> assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isEqualTo(1));
  }

  @Test
  void canjesConcurrentesSoloUnoGana() throws Exception {
    scoped(A, () -> access.issue(A, PERSON_A, "race", NOW.plusSeconds(900), NOW));
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> transactions.execute(status -> access.exchange(A, "race", "race-1", NOW.plusSeconds(1800), NOW)));
      var second = executor.submit(() -> transactions.execute(status -> access.exchange(A, "race", "race-2", NOW.plusSeconds(1800), NOW)));
      assertThat((first.get().isPresent() ? 1 : 0) + (second.get().isPresent() ? 1 : 0)).isEqualTo(1);
    }
  }

  @Test
  void canjesConcurrentesPorHttpSoloUnoObtieneSesion() throws Exception {
    String link = secrets.generate();
    Instant current = Instant.now();
    scoped(A, () -> access.issue(A, PERSON_A, secrets.hash(link), current.plusSeconds(900), current));
    String url = "http://localhost:" + port;
    String path = "/api/v1/public/tenants/" + A.value() + "/history-sessions";
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> exchangeHttpStatus(url, path, link));
      var second = executor.submit(() -> exchangeHttpStatus(url, path, link));
      assertThat(java.util.List.of(first.get(), second.get())).containsExactlyInAnyOrder(200, 401);
    }
    scoped(A, () -> assertThat(jdbc.queryForObject(
        "select count(*) from customer_history_access where session_hash is not null and tenant_id = ?",
        Integer.class, A.value())).isEqualTo(1));
  }

  private int exchangeHttpStatus(String url, String path, String link) {
    return RestTestClient.bindToServer().baseUrl(url)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build()
        .post().uri(path).body("{\"token\":\"" + link + "\"}")
        .exchange().returnResult(Void.class).getStatus().value();
  }

  @Test
  void solicitaYCanjeaPorHttpSinEnumerarCorreosOTenants(CapturedOutput output) {
    AtomicReference<String> delivered = new AtomicReference<>();
    doAnswer(invocation -> {
      delivered.set(invocation.getArgument(1));
      return null;
    }).when(mail).send(any(String.class), any(String.class));
    String base = "/api/v1/public/tenants/" + A.value();
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    http.post().uri(base + "/history-access-requests")
        .body("{\"email\":\"a@history.test\"}").exchange().expectStatus().isAccepted();
    String token = awaitLink(delivered, A.value()).split("#token=")[1].split("\\s")[0];
    http.post().uri(base + "/history-access-requests")
        .body("{\"email\":\"unknown@history.test\"}").exchange().expectStatus().isAccepted();
    http.post().uri("/api/v1/public/tenants/non-existent/history-access-requests")
        .body("{\"email\":\"a@history.test\"}").exchange().expectStatus().isAccepted();
    http.post().uri(base + "/history-sessions")
        .body("{\"token\":\"" + token + "\"}").exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.sessionToken").exists();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    http.post().uri(base + "/history-sessions")
        .body("{\"token\":\"" + token + "\"}").exchange().expectStatus().isUnauthorized();
    http.post().uri("/api/v1/public/tenants/" + B.value() + "/history-sessions")
        .body("{\"token\":\"" + token + "\"}").exchange().expectStatus().isUnauthorized();
    assertThat(output.getAll()).doesNotContain(token);
  }

  @Test
  void cooldownYFalloDeEntregaSonNeutros() {
    doThrow(new IllegalStateException("SMTP unavailable"))
        .when(mail).send(any(String.class), any(String.class));
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    String base = "/api/v1/public/tenants/" + A.value() + "/history-access-requests";
    for (int i = 0; i < 4; i++) {
      http.post().uri(base).body("{\"email\":\"a@history.test\"}")
          .exchange().expectStatus().isAccepted();
    }
    scoped(A, () -> assertThat(jdbc.queryForObject(
        "select count(*) from customer_history_access where tenant_id = ?", Integer.class, A.value()))
        .isEqualTo(3));
    http.post().uri(base).body("{\"email\":\"invalid\"}")
        .exchange().expectStatus().isBadRequest();
  }

  @Test
  void mismoCorreoEnDosTenantsYRespuestaPublicaNeutra() {
    scoped(B, () -> jdbc.update("update person set email = 'a@history.test' where tenant_id = ? and id = ?", B.value(), PERSON_B));
    AtomicReference<String> link = new AtomicReference<>();
    doAnswer(invocation -> { link.set(invocation.getArgument(1)); return null; })
        .when(mail).send(any(String.class), any(String.class));
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    String a = "/api/v1/public/tenants/" + A.value();
    String b = "/api/v1/public/tenants/" + B.value();
    http.post().uri(a + "/history-access-requests").body("{\"email\":\"a@history.test\"}")
        .exchange().expectStatus().isAccepted().expectBody().isEmpty();
    String aToken = awaitLink(link, A.value()).split("#token=")[1].split("\\s")[0];
    http.post().uri(b + "/history-sessions").body("{\"token\":\"" + aToken + "\"}")
        .exchange().expectStatus().isUnauthorized();
    http.post().uri(b + "/history-access-requests").body("{\"email\":\"a@history.test\"}")
        .exchange().expectStatus().isAccepted().expectBody().isEmpty();
    String bToken = awaitLink(link, B.value()).split("#token=")[1].split("\\s")[0];
    http.post().uri(b + "/history-sessions").body("{\"token\":\"" + bToken + "\"}")
        .exchange().expectStatus().isOk();
    // Mismo correo ≠ misma identidad: filas y enlaces permanecen bajo RLS de cada tenant.
    scoped(A, () -> assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isEqualTo(1));
    scoped(B, () -> assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isEqualTo(1));
    assertThat(jdbc.queryForObject("select count(*) from customer_history_access", Integer.class)).isZero();
  }

  @Test
  void historialVacioYCredencialesVencidasNoAutorizan() {
    String link = secrets.generate();
    String token = secrets.generate();
    Instant current = Instant.now();
    scoped(B, () -> access.issue(B, PERSON_B, secrets.hash(link), current.plusSeconds(900), current));
    assertThat(transactions.execute(status -> access.exchange(B, secrets.hash(link),
        secrets.hash(token), current.plusSeconds(1800), current)).isPresent()).isTrue();
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    String base = "/api/v1/public/tenants/" + B.value();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.items.length()").isEqualTo(0)
        .jsonPath("$.asOf").exists();
    http.get().uri(base + "/my-reservations?period=past")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.items.length()").isEqualTo(0);
    scoped(B, () -> jdbc.update("update customer_history_access set session_expires_at = ? where tenant_id = ?",
        java.sql.Timestamp.from(current.minusSeconds(1)), B.value()));
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    http.post().uri(base + "/history-sessions/revoke")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", secrets.generate()).exchange().expectStatus().isUnauthorized();
    // RLS protege la lectura incluso sin tenant configurado, no solo la sesión.
    assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isZero();
  }

  @Test
  void eliminarPersonaInvalidaSesionAunqueNoHayaCaducado() {
    String token = secrets.generate();
    String link = secrets.generate();
    Instant current = Instant.now();
    scoped(A, () -> access.issue(A, PERSON_A, secrets.hash(link), current.plusSeconds(900), current));
    assertThat(transactions.execute(status -> access.exchange(A, secrets.hash(link),
        secrets.hash(token), current.plusSeconds(1800), current)).isPresent()).isTrue();
    scoped(A, () -> jdbc.update("update person set deleted_at = ? where tenant_id = ? and id = ?",
        java.sql.Timestamp.from(current), A.value(), PERSON_A));
    RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build()
        .get().uri("/api/v1/public/tenants/" + A.value() + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token)
        .exchange().expectStatus().isUnauthorized();
  }

  @Test
  void historialPorPersonaPeriodoYRevocacionEnHttpConRls() {
    UUID other = UUID.fromString("93000000-0000-0000-0000-000000000003");
    UUID establishment = UUID.fromString("93000000-0000-0000-0000-000000000011");
    UUID floor = UUID.fromString("93000000-0000-0000-0000-000000000012");
    UUID sector = UUID.fromString("93000000-0000-0000-0000-000000000013");
    UUID element = UUID.fromString("93000000-0000-0000-0000-000000000014");
    UUID publicReservation = UUID.fromString("93000000-0000-0000-0000-000000000021");
    UUID staffReservation = UUID.fromString("93000000-0000-0000-0000-000000000022");
    UUID otherReservation = UUID.fromString("93000000-0000-0000-0000-000000000023");
    UUID confirmed = UUID.fromString("93000000-0000-0000-0000-000000000024");
    UUID active = UUID.fromString("93000000-0000-0000-0000-000000000025");
    UUID released = UUID.fromString("93000000-0000-0000-0000-000000000026");
    UUID staffId = UUID.fromString("93000000-0000-0000-0000-000000000031");
    scoped(A, () -> {
      jdbc.update("insert into person (id, tenant_id, full_name, email) values (?, ?, 'Other', 'other@history.test')", other, A.value());
      jdbc.update("insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, 'staff@history.test', 'unused', 'Staff', 'STAFF')", staffId, A.value());
      jdbc.update("insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, 'Casa A', 'RESTAURANT', 'casa-a', 'America/La_Paz')", establishment, A.value());
      jdbc.update("insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Floor', 1, 'floor')", floor, A.value(), establishment);
      jdbc.update("insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Sector', 'sector', 10)", sector, A.value(), floor);
      jdbc.update("insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, 'TABLE', 'AVAILABLE', 0, 0)", element, A.value(), sector);
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'CANCELLED')",
          publicReservation, A.value(), establishment, PERSON_A,
          java.sql.Timestamp.from(NOW.plusSeconds(60)), java.sql.Timestamp.from(NOW.plusSeconds(3600)));
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'CREATED')",
          staffReservation, A.value(), establishment, PERSON_A,
          java.sql.Timestamp.from(NOW.minusSeconds(3600)), java.sql.Timestamp.from(NOW));
      jdbc.update("update reservation set created_by = ? where tenant_id = ? and id = ?", staffId, A.value(), staffReservation);
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'ACTIVE')",
          otherReservation, A.value(), establishment, other,
          java.sql.Timestamp.from(NOW.plusSeconds(60)), java.sql.Timestamp.from(NOW.plusSeconds(3600)));
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'CONFIRMED')",
          confirmed, A.value(), establishment, PERSON_A,
          java.sql.Timestamp.from(NOW.plusSeconds(3600)), java.sql.Timestamp.from(NOW.plusSeconds(7200)));
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'ACTIVE')",
          active, A.value(), establishment, PERSON_A,
          java.sql.Timestamp.from(NOW.minusSeconds(60)), java.sql.Timestamp.from(NOW.plusSeconds(30)));
      jdbc.update("insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'RELEASED')",
          released, A.value(), establishment, PERSON_A,
          java.sql.Timestamp.from(NOW.minusSeconds(7200)), java.sql.Timestamp.from(NOW.minusSeconds(3600)));
      for (UUID id : new UUID[] {publicReservation, staffReservation, otherReservation, confirmed, active, released}) {
        jdbc.update("insert into reservation_space_element (tenant_id, reservation_id, space_element_id) values (?, ?, ?)", A.value(), id, element);
      }
    });
    scoped(A, () -> {
      assertThat(jdbc.queryForObject("select created_by from reservation where id = ?", UUID.class, publicReservation)).isNull();
      assertThat(jdbc.queryForObject("select created_by from reservation where id = ?", UUID.class, staffReservation)).isEqualTo(staffId);
    });
    String token = secrets.generate();
    String link = secrets.generate();
    Instant current = Instant.now();
    scoped(A, () -> access.issue(A, PERSON_A, secrets.hash(link), current.plusSeconds(900), current));
    assertThat(transactions.execute(status -> access.exchange(A, secrets.hash(link),
        secrets.hash(token), current.plusSeconds(1800), current)).isPresent()).isTrue();
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    String base = "/api/v1/public/tenants/" + A.value();
    http.get().uri(base + "/my-reservations?period=upcoming&asOf=" + NOW)
        .exchange().expectStatus().isUnauthorized();
    http.get().uri(base + "/my-reservations?period=upcoming&asOf=" + NOW + "&limit=2")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.items.length()").isEqualTo(2)
        .jsonPath("$.items[0].id").isEqualTo(active.toString())
        .jsonPath("$.items[0].status").isEqualTo("ACTIVE")
        .jsonPath("$.items[1].id").isEqualTo(publicReservation.toString())
        .jsonPath("$.items[1].status").isEqualTo("CANCELLED")
        .jsonPath("$.items[1].timezone").isEqualTo("America/La_Paz")
        .jsonPath("$.items[1].spaceElementIds[0]").isEqualTo(element.toString())
        .jsonPath("$.hasMore").isEqualTo(true);
    Map<?, ?> response = http.get().uri(base + "/my-reservations?period=upcoming&asOf=" + NOW)
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody(Map.class).returnResult().getResponseBody();
    assertThat(response).isNotNull();
    assertThat(response.toString()).doesNotContain("personId", "createdBy", "email", token);
    http.get().uri(base + "/my-reservations?period=upcoming&asOf=" + NOW + "&limit=1&offset=2")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.items[0].id").isEqualTo(confirmed.toString())
        .jsonPath("$.items[0].status").isEqualTo("CONFIRMED")
        .jsonPath("$.hasMore").isEqualTo(false);
    http.get().uri(base + "/my-reservations?period=past&asOf=" + NOW)
        .header("X-Customer-History-Session", token).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.items[0].id").isEqualTo(staffReservation.toString())
        .jsonPath("$.items[0].status").isEqualTo("CREATED")
        .jsonPath("$.items[1].id").isEqualTo(released.toString())
        .jsonPath("$.items[1].status").isEqualTo("RELEASED");
    http.get().uri("/api/v1/public/tenants/" + B.value() + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).header("Authorization", "Bearer invalid")
        .exchange().expectStatus().isUnauthorized();
    String staff = staffTokens.issue(new AuthenticatedUser(staffId, A,
        "staff@history.test", "Staff Tester", UserRole.STAFF)).value();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("Authorization", "Bearer " + staff).exchange().expectStatus().isUnauthorized();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("Authorization", "Bearer " + token).exchange().expectStatus().isUnauthorized();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("Authorization", "Bearer " + staff)
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    http.get().uri("/api/v1/reservations").header("X-Customer-History-Session", token)
        .exchange().expectStatus().isUnauthorized();
    http.get().uri("/api/v1/reservations").header("Authorization", "Bearer " + staff)
        .exchange().expectStatus().isOk().expectBody()
        .jsonPath("$.length()").isEqualTo(6);
    http.post().uri(base + "/history-sessions/revoke")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isNoContent();
    http.get().uri(base + "/my-reservations?period=upcoming")
        .header("X-Customer-History-Session", token).exchange().expectStatus().isUnauthorized();
    scoped(A, () -> assertThat(jdbc.queryForObject(
        "select session_hash from customer_history_access where tenant_id = ?", String.class, A.value())).isNull());
    http.options().uri(base + "/my-reservations")
        .header("Origin", "http://localhost:4300")
        .header("Access-Control-Request-Method", "GET")
        .header("Access-Control-Request-Headers", "X-Customer-History-Session")
        .exchange().expectStatus().isOk()
        .expectHeader().valueEquals("Access-Control-Allow-Origin", "http://localhost:4300");
  }

  private void scoped(TenantId tenant, Runnable action) {
    transactions.executeWithoutResult(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
      action.run();
    });
  }

  private Optional<UUID> exchange(TenantId tenant, String link, String session, Instant now) {
    return transactions.execute(status -> access.exchange(tenant, link, session, now.plusSeconds(1800), now));
  }

  private Optional<UUID> session(TenantId tenant, String hash, Instant now) {
    return transactions.execute(status -> access.validSession(tenant, hash, now));
  }

  private String awaitLink(AtomicReference<String> link, String slug) {
    long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
    while (System.nanoTime() < deadline) {
      String value = link.get();
      if (value != null && value.contains("/mis-reservas/" + slug + "#token=")) return value;
      try {
        Thread.sleep(10);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        throw new AssertionError("Interrupted while awaiting mail delivery", exception);
      }
    }
    throw new AssertionError("No se entregó el enlace esperado");
  }
}
