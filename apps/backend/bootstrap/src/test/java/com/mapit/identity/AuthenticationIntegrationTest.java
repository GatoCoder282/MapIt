package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

import com.mapit.identity.application.AuthenticateUser;
import com.mapit.identity.application.AuthenticateUserCommand;
import com.mapit.identity.domain.InvalidCredentialsException;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

/** Integra migración, BCrypt y caso de uso con conexiones sujetas a RLS. */
@Tag("integration")
@SpringBootTest
class AuthenticationIntegrationTest {
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("mapit_auth_test").withUsername("mapit_test").withPassword("test_password");
    private static final UUID USER_A = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static JdbcTemplate admin;

    @Autowired private AuthenticateUser authenticate;
    @Autowired private PasswordEncoder encoder;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        // Alternativa para máquinas sin Docker: exclusivamente una BD desechable de pruebas.
        String externalUrl = System.getenv("MAPIT_TEST_JDBC_URL");
        String url;
        String user;
        String password;
        if (externalUrl == null) {
            POSTGRES.start();
            url = POSTGRES.getJdbcUrl();
            user = POSTGRES.getUsername();
            password = POSTGRES.getPassword();
        } else {
            url = externalUrl;
            user = System.getenv().getOrDefault("MAPIT_TEST_DB_USER", "mapit_test");
            password = System.getenv().getOrDefault("MAPIT_TEST_DB_PASSWORD", "test_password");
        }
        admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        admin.execute("""
                do $$ begin
                    if not exists (select from pg_roles where rolname = 'mapit_auth_test') then
                        create role mapit_auth_test nologin nosuperuser nobypassrls;
                    end if;
                end $$
                """);
        admin.execute("grant usage on schema public to mapit_auth_test");
        admin.execute("alter default privileges in schema public grant select, insert on tables to mapit_auth_test");
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> user);
        registry.add("spring.datasource.password", () -> password);
        registry.add("spring.datasource.hikari.connection-init-sql", () -> "set role mapit_auth_test");
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> 2);
        // Flyway tiene su conexión administrativa; la aplicación usa un rol sin bypass.
        registry.add("spring.flyway.url", () -> url);
        registry.add("spring.flyway.user", () -> user);
        registry.add("spring.flyway.password", () -> password);
    }

    @AfterAll
    static void stopDatabase() {
        if (POSTGRES.isRunning()) {
            POSTGRES.stop();
        }
    }

    @BeforeEach
    void prepareAccounts() {
        admin.execute("grant select, insert on all tables in schema public to mapit_auth_test");
        admin.update("delete from app_user where tenant_id in ('auth-a', 'auth-b')");
        admin.update("""
                insert into tenant (id, name, slug, status, vertical) values
                    ('auth-a', 'Empresa A', 'empresa-a', 'ACTIVE', 'RESTAURANT'),
                    ('auth-b', 'Empresa B', 'empresa-b', 'ACTIVE', 'RESTAURANT')
                on conflict (id) do update set status = 'ACTIVE'
                """);
        insertUser(USER_A, "auth-a", "clave-a", "ADMIN");
        insertUser(UUID.randomUUID(), "auth-b", "clave-b", "STAFF");
    }

    @Test
    void autentica_con_bcrypt_y_devuelve_identidad_persistida() {
        var result = authenticate.execute(command(" EMPRESA-A ", "clave-a"));
        assertThat(result.id()).isEqualTo(USER_A);
        assertThat(result.tenantId()).isEqualTo(TenantId.of("auth-a"));
        assertThat(result.role()).isEqualTo(UserRole.ADMIN);
        assertThat(result.email()).isEqualTo("staff@example.test");
    }

    @Test
    void mismo_correo_en_otro_tenant_no_comparte_credenciales() {
        assertRejected("empresa-b", "clave-a");
        assertThat(authenticate.execute(command("empresa-b", "clave-b")).tenantId())
                .isEqualTo(TenantId.of("auth-b"));
        assertRejected("empresa-a", "clave-b");
    }

    @Test
    void rechaza_cuenta_inactiva_y_empresa_suspendida() {
        admin.update("update app_user set active = false where id = ?", USER_A);
        assertRejected("empresa-a", "clave-a");
        admin.update("update app_user set active = true where id = ?", USER_A);
        admin.update("update tenant set status = 'SUSPENDED' where id = 'auth-a'");
        assertRejected("empresa-a", "clave-a");
    }

    @Test
    void errores_de_credenciales_y_cuentas_inexistentes_son_uniformes() {
        assertRejected("empresa-a", "incorrecta");
        assertRejected("empresa-inexistente", "clave-a");
        assertThatThrownBy(() -> authenticate.execute(
                new AuthenticateUserCommand("empresa-a", "inexistente@example.test", "clave-a")))
                .isInstanceOf(InvalidCredentialsException.class).hasMessage("Credenciales inválidas.");
    }

    @Test
    void rls_falla_cerrado_y_aisla_lectura_y_escritura() {
        assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_auth_test");
        assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            setTenant("auth-a");
            assertThat(jdbc.queryForObject("select id from app_user", UUID.class)).isEqualTo(USER_A);
            assertThat(jdbc.queryForObject("select count(*) from app_user where tenant_id = 'auth-b'", Long.class))
                    .isZero();
        });
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            setTenant("auth-a");
            jdbc.update("""
                    insert into app_user (tenant_id, email, password_hash, full_name, role)
                    values ('auth-b', 'intruso@example.test', 'unused', 'Intruso', 'STAFF')
                    """);
        })).isInstanceOf(DataAccessException.class);
    }

    @Test
    void autenticacion_no_filtra_el_tenant_a_la_siguiente_operacion() {
        authenticate.execute(command("empresa-a", "clave-a"));
        assertThat(jdbc.queryForObject("select current_tenant_id()", String.class)).isNull();
        assertRejected("empresa-b", "incorrecta");
        assertThat(jdbc.queryForObject("select current_tenant_id()", String.class)).isNull();
        assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
    }

    @Test
    void autenticacion_preserva_el_contexto_de_una_transaccion_exterior() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            setTenant("auth-b");
            assertThat(authenticate.execute(command("empresa-a", "clave-a")).id()).isEqualTo(USER_A);
            assertThat(jdbc.queryForObject("select current_tenant_id()", String.class)).isEqualTo("auth-b");
            assertThat(jdbc.queryForObject("select tenant_id from app_user", String.class)).isEqualTo("auth-b");
        });
    }

    @Test
    void correo_es_unico_dentro_del_tenant_y_debe_estar_normalizado() {
        assertThatThrownBy(() -> insertUser(UUID.randomUUID(), "auth-a", "otra-clave", "STAFF"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> admin.update("update app_user set email = ' Staff@Example.Test ' where id = ?", USER_A))
                .isInstanceOf(DataAccessException.class);
    }

    private void insertUser(UUID id, String tenantId, String password, String role) {
        admin.update("""
                insert into app_user (id, tenant_id, email, password_hash, full_name, role)
                values (?, ?, 'staff@example.test', ?, 'Operador', ?)
                """, id, tenantId, encoder.encode(password), role);
    }

    private void setTenant(String tenantId) {
        jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId);
    }

    private static AuthenticateUserCommand command(String slug, String password) {
        return new AuthenticateUserCommand(slug, " Staff@Example.Test ", password);
    }

    private void assertRejected(String slug, String password) {
        assertThatThrownBy(() -> authenticate.execute(command(slug, password)))
                .isInstanceOf(InvalidCredentialsException.class).hasMessage("Credenciales inválidas.");
    }
}
