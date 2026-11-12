package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** T05: endpoints reales con PG17 y mapit_app; sustituye el test del POST legacy. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TenantUserManagementIntegrationTest {
  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "test_app_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @LocalServerPort private int port;
  @Autowired private AccessTokenIssuer tokens;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;

  @Test
  void listado_y_detalle_aislados_sin_credenciales_ni_rol_obsoleto() {
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@a.test");
    UUID otherAdmin = user(a, UserRole.ADMIN, "other@a.test");
    UUID staff = user(a, UserRole.STAFF, "staff@a.test");
    UUID outside = user(b, UserRole.STAFF, "staff@b.test");
    String bearer = token(a, admin, UserRole.ADMIN);

    String page = http().get().uri("/api/v1/users?page=0&size=2")
        .header("Authorization", bearer).exchange().expectStatus().isOk()
        .expectHeader().valueEquals("Cache-Control", "no-store")
        .expectBody(String.class).returnResult().getResponseBody();
    assertThat(page).contains("\"totalElements\":3", "\"totalPages\":2")
        .doesNotContain("password_hash", "passwordHash", "staff@b.test");
    http().get().uri("/api/v1/users/" + otherAdmin).header("Authorization", bearer)
        .exchange().expectStatus().isOk().expectBody(String.class)
        .value(body -> assertThat(body).contains("other@a.test").doesNotContain("password"));
    http().get().uri("/api/v1/users/" + outside).header("Authorization", bearer)
        .exchange().expectStatus().isNotFound();
    http().get().uri("/api/v1/users/" + UUID.randomUUID()).header("Authorization", bearer)
        .exchange().expectStatus().isNotFound();
    http().get().uri("/api/v1/users?page=-1").header("Authorization", bearer)
        .exchange().expectStatus().isBadRequest();
    http().get().uri("/api/v1/users?size=101").header("Authorization", bearer)
        .exchange().expectStatus().isBadRequest();
    http().get().uri("/api/v1/users/not-a-uuid").header("Authorization", bearer)
        .exchange().expectStatus().isBadRequest();
    http().get().uri("/api/v1/users").header("Authorization", token(a, staff, UserRole.STAFF))
        .exchange().expectStatus().isForbidden();
    http().get().uri("/api/v1/users").exchange().expectStatus().isUnauthorized();
    UUID superAdmin = user("platform", UserRole.SUPER_ADMIN, "sa-" + UUID.randomUUID() + "@example.test");
    http().get().uri("/api/v1/users").header("Authorization", token("platform", superAdmin, UserRole.SUPER_ADMIN))
        .exchange().expectStatus().isForbidden();
    // JWT firmado con rol ADMIN para una cuenta cuya fila es STAFF: no autoriza.
    http().get().uri("/api/v1/users").header("Authorization", token(a, staff, UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users/" + admin).header("Authorization", bearer)
        .exchange().expectStatus().isOk();
  }

  @Test
  void mutaciones_solo_de_miembros_con_auditoria_atomica_y_conflictos() {
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@mut.test");
    UUID another = user(a, UserRole.ADMIN, "other@mut.test");
    UUID manager = user(a, UserRole.MANAGER, "manager@mut.test");
    UUID outsider = user(b, UserRole.STAFF, "outside@mut.test");
    String bearer = token(a, admin, UserRole.ADMIN);

    http().patch().uri("/api/v1/users/" + manager + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "MANAGER", "role", "STAFF"))
        .exchange().expectStatus().isOk();
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select role from app_user where tenant_id=? and id=?", String.class, a, manager)).isEqualTo("STAFF");
      assertThat(jdbc.queryForObject("select count(*) from audit_log where tenant_id=? and actor_id=? and resource_id=? and event_type='USER_ROLE_CHANGED'", Long.class, a, admin, manager)).isEqualTo(1);
    });
    http().patch().uri("/api/v1/users/" + manager + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "MANAGER", "role", "STAFF"))
        .exchange().expectStatus().isEqualTo(409);
    http().patch().uri("/api/v1/users/" + manager + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "STAFF", "role", "STAFF"))
        .exchange().expectStatus().isOk();
    http().patch().uri("/api/v1/users/" + another + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "STAFF", "role", "MANAGER"))
        .exchange().expectStatus().isForbidden();
    http().patch().uri("/api/v1/users/" + admin + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "STAFF", "role", "MANAGER"))
        .exchange().expectStatus().isForbidden();
    http().patch().uri("/api/v1/users/" + manager + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "STAFF", "role", "ADMIN"))
        .exchange().expectStatus().isForbidden();
    for (UUID forbidden : new UUID[] {admin, another}) {
      http().patch().uri("/api/v1/users/" + forbidden + "/access").header("Authorization", bearer)
          .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false))
          .exchange().expectStatus().isForbidden();
    }
    http().patch().uri("/api/v1/users/" + outsider + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false))
        .exchange().expectStatus().isNotFound();
    http().patch().uri("/api/v1/users/" + manager + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", true))
        .exchange().expectStatus().isBadRequest();
    http().patch().uri("/api/v1/users/" + manager + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false))
        .exchange().expectStatus().isOk();
    http().patch().uri("/api/v1/users/" + manager + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false))
        .exchange().expectStatus().isOk();
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select active from app_user where tenant_id=? and id=?", Boolean.class, a, manager)).isFalse();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where tenant_id=? and resource_id=? and event_type='USER_DEACTIVATED'", Long.class, a, manager)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where tenant_id=? and resource_id=? and event_type='USER_ROLE_CHANGED'", Long.class, a, manager)).isEqualTo(1);
      for (String type : new String[] {"USER_ROLE_CHANGED", "USER_DEACTIVATED"}) {
        var event = jdbc.queryForMap("""
            select tenant_id,actor_id,resource_id,occurred_at,details::text as details
            from audit_log where tenant_id=? and resource_id=? and event_type=?
            """, a, manager, type);
        assertThat(event).containsEntry("tenant_id", a).containsEntry("actor_id", admin)
            .containsEntry("resource_id", manager);
        assertThat(event.get("occurred_at")).isNotNull();
        assertThat(event.get("details").toString()).doesNotContain("password", "token", "hash");
      }
    });
    http().get().uri("/api/v1/users").header("Authorization", token(a, manager, UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, admin));
    http().get().uri("/api/v1/users").header("Authorization", bearer)
        .exchange().expectStatus().isUnauthorized();
  }

  @Test
  void post_legacy_rechazado_y_emision_real_sin_cuenta_activa() {
    String a = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@post.test");
    UUID staff = user(a, UserRole.STAFF, "staff@post.test");
    String bearer = token(a, admin, UserRole.ADMIN);
    http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", "new@post.test", "role", "STAFF", "password", "legacy"))
        .exchange().expectStatus().isBadRequest();
    http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "new@post.test", "role", "ADMIN"))
        .exchange().expectStatus().isForbidden();
    http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "new@post.test", "role", "STAFF"))
        .exchange().expectStatus().isAccepted();
    http().post().uri("/api/v1/user-invitations/" + UUID.randomUUID() + "/resend")
        .header("Authorization", bearer).exchange().expectStatus().isNotFound();
    http().post().uri("/api/v1/users").header("Authorization", token(a, staff, UserRole.STAFF))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "new@post.test", "role", "STAFF"))
        .exchange().expectStatus().isForbidden();
    UUID superAdmin = user("platform", UserRole.SUPER_ADMIN, "sa-" + UUID.randomUUID() + "@example.test");
    http().post().uri("/api/v1/users").header("Authorization", token("platform", superAdmin, UserRole.SUPER_ADMIN))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "new@post.test", "role", "ADMIN"))
        .exchange().expectStatus().isForbidden();
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select count(*) from app_user where email='new@post.test'", Long.class)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='new@post.test' and purpose='MEMBER'", Long.class)).isEqualTo(1);
    });
  }

  @Test
  void tenant_suspendido_y_principal_inexistente_fallan_cerrados() {
    String a = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@suspended.test");
    String bearer = token(a, admin, UserRole.ADMIN);
    jdbc.update("update tenant set status='SUSPENDED' where id=?", a);
    http().get().uri("/api/v1/users").header("Authorization", bearer)
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users").header("Authorization", token(a, UUID.randomUUID(), UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
  }

  @Test
  void uuid_y_payload_ajenos_no_cambian_tenant_ni_generan_auditoria() {
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@cross.test");
    UUID foreign = user(b, UserRole.MANAGER, "manager@cross.test");
    String bearer = token(a, admin, UserRole.ADMIN);

    http().get().uri("/api/v1/users?tenantId=" + b).header("Authorization", bearer)
        .exchange().expectStatus().isOk().expectBody(String.class)
        .value(body -> assertThat(body).doesNotContain("manager@cross.test"));
    http().get().uri("/api/v1/users/" + foreign).header("Authorization", bearer)
        .exchange().expectStatus().isNotFound();
    http().patch().uri("/api/v1/users/" + foreign + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "MANAGER", "role", "STAFF"))
        .exchange().expectStatus().isNotFound();
    http().patch().uri("/api/v1/users/" + foreign + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false))
        .exchange().expectStatus().isNotFound();
    http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "injected@cross.test", "role", "STAFF", "tenantId", b))
        .exchange().expectStatus().isBadRequest();
    http().patch().uri("/api/v1/users/" + foreign + "/role").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("expectedRole", "MANAGER", "role", "STAFF", "tenantId", b))
        .exchange().expectStatus().isBadRequest();
    http().patch().uri("/api/v1/users/" + foreign + "/access").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("active", false, "tenantId", b))
        .exchange().expectStatus().isBadRequest();
    inTenant(b, () -> {
      assertThat(jdbc.queryForObject("select role from app_user where id=?", String.class, foreign)).isEqualTo("MANAGER");
      assertThat(jdbc.queryForObject("select active from app_user where id=?", Boolean.class, foreign)).isTrue();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where resource_id=?", Long.class, foreign)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from app_user where email='injected@cross.test'", Long.class)).isZero();
    });
    inTenant(a, () -> assertThat(jdbc.queryForObject(
        "select count(*) from invitation_tokens where email='injected@cross.test'", Long.class)).isZero());
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String tenant() {
    String id = "t05-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update("insert into tenant (id,name,slug,status,vertical) values (?,'T05',?,'ACTIVE','RESTAURANT')", id, id);
    return id;
  }

  private UUID user(String tenant, UserRole role, String email) {
    UUID id = UUID.randomUUID();
    inTenant(tenant, () -> jdbc.update("insert into app_user (id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'hash-fixture','Test',?)", id, tenant, email, role.name()));
    return id;
  }

  private String token(String tenant, UUID id, UserRole role) {
    return "Bearer " + tokens.issue(new AuthenticatedUser(id, TenantId.of(tenant),
        "test@fixture.test", "Test", role)).value();
  }

  private void inTenant(String tenant, Runnable action) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
      action.run();
    });
  }
}
