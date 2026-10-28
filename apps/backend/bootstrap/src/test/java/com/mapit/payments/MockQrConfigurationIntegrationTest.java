package com.mapit.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.LockSupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

/** Persistencia real del QR de prueba: CRUD, duplicados, aislamiento por tenant y RLS. */
@Tag("integration")
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class MockQrConfigurationIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("integration_owner_password");

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired AccessTokenIssuer tokens;
  @Autowired TransactionTemplate transactions;
  String tenantA;
  String tenantB;
  UUID adminA;
  UUID adminB;
  UUID establishmentA;
  UUID establishmentB;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "integration_runtime_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.payments.mock.enabled", () -> "true");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void seed() {
    tenantA = "mock-qr-" + UUID.randomUUID();
    tenantB = "mock-qr-" + UUID.randomUUID();
    adminA = UUID.randomUUID();
    adminB = UUID.randomUUID();
    establishmentA = UUID.randomUUID();
    establishmentB = UUID.randomUUID();
    seedTenant(tenantA, adminA, establishmentA);
    seedTenant(tenantB, adminB, establishmentB);
  }

  @Test
  void createsReadsUpdatesAndRegeneratesPersistedConfiguration() {
    Config created = create(adminA, tenantA, establishmentA);
    assertThat(created.simulationPath()).isEqualTo("/simulacion/qr/" + created.simulationToken());
    assertThat(created.simulationPath()).doesNotContain("Banco", "Titular", "cuenta-123");

    client().get().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(1)
        .jsonPath("$[0].id").isEqualTo(created.id().toString());

    client().get().uri("/api/v1/payment-methods/mock-qr/" + created.id())
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody()
        .jsonPath("$.id").isEqualTo(created.id().toString())
        .jsonPath("$.establishmentId").isEqualTo(establishmentA.toString())
        .jsonPath("$.simulationToken").isEqualTo(created.simulationToken().toString())
        .jsonPath("$.simulationPath").isEqualTo(created.simulationPath());

    Map<String, Object> update = request(establishmentA);
    update.put("bankName", "Banco actualizado");
    update.put("enabled", false);
    client().put().uri("/api/v1/payment-methods/mock-qr/" + created.id())
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(update)
        .exchange().expectStatus().isOk().expectBody()
        .jsonPath("$.bankName").isEqualTo("Banco actualizado")
        .jsonPath("$.enabled").isEqualTo(false)
        .jsonPath("$.simulationToken").isEqualTo(created.simulationToken().toString());

    Config regenerated = client().post()
        .uri("/api/v1/payment-methods/mock-qr/" + created.id() + "/regenerate")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody(Config.class).returnResult().getResponseBody();
    assertThat(regenerated).isNotNull();
    assertThat(regenerated.simulationToken()).isNotEqualTo(created.simulationToken());
    assertThat(regenerated.bankName()).isEqualTo("Banco actualizado");
    assertThat(regenerated.enabled()).isFalse();
    assertThat(jdbc.queryForObject("select count(*) from mock_qr_configuration where tenant_id=?",
        Integer.class, tenantA)).isEqualTo(1);
  }

  @Test void readiness_qr_first_sin_policy_es_readonly_y_guardado_explicito_sincroniza_solo_local() {
    create(adminA,tenantA,establishmentA);
    String path="/api/v1/establishments/"+establishmentA+"/payment-readiness";
    client().get().uri(path).exchange().expectStatus().isUnauthorized();
    client().get().uri(path).headers(h -> h.setBearerAuth(token(adminA,tenantA,UserRole.STAFF))).exchange().expectStatus().isForbidden();
    client().get().uri(path).headers(h -> h.setBearerAuth(token(adminB,tenantB,UserRole.ADMIN))).exchange().expectStatus().isNotFound();
    for(int i=0;i<2;i++) {
      client().get().uri(path).headers(h -> h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
          .exchange().expectStatus().isOk().expectBody().jsonPath("$.policy").isEmpty()
          .jsonPath("$.qrEnabled").isEqualTo(true).jsonPath("$.ready").isEqualTo(false)
          .jsonPath("$.blockers[0]").isEqualTo("POLICY_MISSING").jsonPath("$.blockers.length()").isEqualTo(1);
    }
    assertThat(jdbc.queryForObject("select count(*) from payment_policy where tenant_id=?",Integer.class,tenantA)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id=?",Integer.class,tenantA)).isZero();
    client().put().uri("/api/v1/establishments/"+establishmentA+"/payment-policy")
        .headers(h -> h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN))).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("enabled",true,"currency","USD","depositAmount","12.50","paymentWindowMinutes",30))
        .exchange().expectStatus().isOk();
    client().get().uri(path).headers(h -> h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.ready").isEqualTo(true).jsonPath("$.blockers").isEmpty()
        .jsonPath("$.policy.depositAmount").isEqualTo("12.50");
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id=? and establishment_id=?",Integer.class,tenantA,establishmentA)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from payment_policy where tenant_id=?",Integer.class,tenantB)).isZero();
    jdbc.update("update merchant_payment_method set enabled=false,currency='BOB' where tenant_id=? and establishment_id=?",tenantA,establishmentA);
    client().get().uri(path).headers(h -> h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.ready").isEqualTo(false)
        .jsonPath("$.blockers[0]").isEqualTo("METHOD_DISABLED").jsonPath("$.blockers[1]").isEqualTo("METHOD_CURRENCY_MISMATCH");
  }

  @Test
  void synchronizesConfigurationAndPolicyIntoOneLocalProjection() {
    Config config = create(adminA, tenantA, establishmentA);
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=?",
        Integer.class, tenantA, config.id())).isZero();

    savePolicy(adminA, tenantA, establishmentA, false, "USD");
    UUID methodId = jdbc.queryForObject("select id from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=? and superseded_at is null",
        UUID.class, tenantA, config.id());
    assertThat(jdbc.queryForObject("select provider from merchant_payment_method where id=?", String.class, methodId))
        .isEqualTo("MOCK_GATEWAY");
    assertThat(jdbc.queryForObject("select currency from merchant_payment_method where id=?", String.class, methodId))
        .isEqualTo("USD");
    assertThat(jdbc.queryForObject("select enabled from payment_policy where tenant_id=? and establishment_id=?",
        Boolean.class, tenantA, establishmentA)).isFalse();

    Map<String, Object> update = request(establishmentA);
    update.put("bankName", "Banco actualizado");
    client().put().uri("/api/v1/payment-methods/mock-qr/" + config.id())
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(update).exchange().expectStatus().isOk();
    assertThat(jdbc.queryForObject("select id from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=? and superseded_at is null",
        UUID.class, tenantA, config.id())).isEqualTo(methodId);
    assertThat(jdbc.queryForObject("select bank_name from merchant_payment_method where id=?", String.class, methodId))
        .isEqualTo("Banco actualizado");

    savePolicy(adminA, tenantA, establishmentA, false, "BOB");
    assertThat(jdbc.queryForObject("select currency from merchant_payment_method where id=?", String.class, methodId))
        .isEqualTo("BOB");
    assertThat(jdbc.queryForObject("select enabled from payment_policy where tenant_id=? and establishment_id=?",
        Boolean.class, tenantA, establishmentA)).isFalse();
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=? and superseded_at is null",
        Integer.class, tenantA, config.id())).isEqualTo(1);
  }

  @Test
  void configuration_update_waiting_for_establishment_does_not_hold_qr_row_lock() throws Exception {
    Config config = create(adminA, tenantA, establishmentA);
    var future = new AtomicReference<java.util.concurrent.Future<Integer>>();
    try (var executor = Executors.newSingleThreadExecutor()) {
      transactions.executeWithoutResult(status -> {
        jdbc.queryForObject("select id from establishment where tenant_id=? and id=? for no key update",
            UUID.class, tenantA, establishmentA);
        future.set(executor.submit(() -> {
          Map<String, Object> update = request(establishmentA);
          update.put("bankName", "Banco concurrente");
          return client().put().uri("/api/v1/payment-methods/mock-qr/" + config.id())
              .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
              .contentType(MediaType.APPLICATION_JSON).body(update).exchange().returnResult(Void.class).getStatus().value();
        }));
        awaitEstablishmentLockWait();
        assertThat(jdbc.queryForObject("select id from mock_qr_configuration where tenant_id=? and id=? for key share",
            UUID.class, tenantA, config.id())).isEqualTo(config.id());
      });
      assertThat(future.get().get(10, TimeUnit.SECONDS)).isEqualTo(200);
    }
  }

  @Test
  void rejectsForeignTenantsAndEstablishmentsAndDuplicates() {
    Config created = create(adminA, tenantA, establishmentA);

    client().get().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().json("[]");
    client().get().uri("/api/v1/payment-methods/mock-qr/" + created.id())
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .exchange().expectStatus().isNotFound();
    client().put().uri("/api/v1/payment-methods/mock-qr/" + created.id())
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishmentB))
        .exchange().expectStatus().isNotFound();
    client().post().uri("/api/v1/payment-methods/mock-qr/" + created.id() + "/regenerate")
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .exchange().expectStatus().isNotFound();

    client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishmentB))
        .exchange().expectStatus().isNotFound();
    client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishmentA))
        .exchange().expectStatus().isEqualTo(409);

    Map<String, Object> invalidCountry = request(establishmentA);
    invalidCountry.put("country", "ZZ");
    client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(invalidCountry)
        .exchange().expectStatus().isBadRequest();
    Map<String, Object> blankHolder = request(establishmentA);
    blankHolder.put("accountHolderName", " ");
    client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(blankHolder)
        .exchange().expectStatus().isBadRequest();

    client().get().uri("/api/v1/payment-methods/mock-qr").exchange().expectStatus().isUnauthorized();
    client().get().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.STAFF)))
        .exchange().expectStatus().isForbidden();
  }

  @Test
  void runtimeRoleRlsFailsClosedAndRejectsCrossTenantWrites() {
    create(adminA, tenantA, establishmentA);
    create(adminB, tenantB, establishmentB);

    transactions.executeWithoutResult(status -> {
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id', '', true)", String.class);
      assertThat(jdbc.queryForObject("select count(*) from mock_qr_configuration", Integer.class)).isZero();
      jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantA);
      assertThat(jdbc.queryForObject("select count(*) from mock_qr_configuration", Integer.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject(
          "select count(*) from mock_qr_configuration where tenant_id=?", Integer.class, tenantB)).isZero();
    });

    assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantA);
      jdbc.update("""
          insert into mock_qr_configuration(id,tenant_id,establishment_id,country,bank_name,account_holder_name,
            account_reference,enabled,simulation_token,created_at,updated_at,created_by,updated_by)
          values(?,?,?,'BO','Banco ajeno','Titular','cuenta',true,gen_random_uuid(),now(),now(),?,?)
          """, UUID.randomUUID(), tenantB, establishmentB, adminB, adminB);
    })).isInstanceOf(DataAccessException.class);
  }

  private Config create(UUID user, String tenant, UUID establishment) {
    Config created = client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h -> h.setBearerAuth(token(user, tenant, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishment))
        .exchange().expectStatus().isCreated().expectBody(Config.class).returnResult().getResponseBody();
    assertThat(created).isNotNull();
    return created;
  }

  private Map<String, Object> request(UUID establishment) {
    Map<String, Object> request = new HashMap<>();
    request.put("establishmentId", establishment);
    request.put("country", "BO");
    request.put("bankName", "Banco de prueba");
    request.put("accountHolderName", "Titular de prueba");
    request.put("accountReference", "cuenta-123");
    request.put("enabled", true);
    return request;
  }

  private void savePolicy(UUID admin, String tenant, UUID establishment, boolean enabled, String currency) {
    Map<String, Object> policy = new HashMap<>();
    policy.put("enabled", enabled);
    policy.put("currency", currency);
    policy.put("depositAmount", "10.00");
    policy.put("totalAmount", null);
    policy.put("paymentWindowMinutes", 30);
    client().put().uri("/api/v1/establishments/" + establishment + "/payment-policy")
        .headers(h -> h.setBearerAuth(token(admin, tenant, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(policy).exchange().expectStatus().isOk();
  }

  private void awaitEstablishmentLockWait() {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (System.nanoTime() < deadline) {
      Boolean waiting = jdbc.queryForObject("""
          select exists(select 1 from pg_locks
            where not granted and pid <> pg_backend_pid())
          """, Boolean.class);
      if (Boolean.TRUE.equals(waiting)) return;
      LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(10));
    }
    throw new AssertionError("La petición de actualización no quedó esperando el lock del establecimiento");
  }

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UUID user, String tenant, UserRole role) {
    return tokens.issue(new AuthenticatedUser(user, TenantId.of(tenant), "staff@mock-qr.test",
        "Staff", role)).value();
  }

  private void seedTenant(String tenant, UUID user, UUID establishment) {
    jdbc.update("insert into tenant (id,name,slug,status,vertical) values (?,? ,?,'ACTIVE','RESTAURANT')",
        tenant, tenant, tenant);
    jdbc.update("insert into app_user (id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'unused','Admin','ADMIN')",
        user, tenant, user + "@mock-qr.test");
    jdbc.update("insert into establishment (id,tenant_id,name,type,slug) values (?,?,'Local','RESTAURANT',?)",
        establishment, tenant, tenant);
  }

  record Config(UUID id, UUID establishmentId, String country, String bankName,
      String accountHolderName, String accountReference, boolean enabled, UUID simulationToken,
      String simulationPath) {}
}
