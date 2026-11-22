package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.application.OwnProfileFailure;
import com.mapit.identity.application.OwnProfileFailure.Reason;
import com.mapit.identity.application.OwnProfileService;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JdbcPersonalProfileRepository;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;
import com.zaxxer.hikari.HikariDataSource;

/** PostgreSQL/RLS reales sin Spring Boot. Requiere Docker: no ejecutar en la etapa sin infraestructura. */
@Tag("integration")
@Testcontainers
class PersonalProfilePersistenceIntegrationTest {
    private static final String APP_PASSWORD = "profile_test_app_password";
    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("mapit_profiles").withUsername("mapit").withPassword("test_owner_password");
    private static final AuthenticatedPrincipal A = actor("profile-a", "00000000-0000-0000-0000-000000000285", UserRole.ADMIN);
    private static final AuthenticatedPrincipal B = actor("profile-a", "00000000-0000-0000-0000-000000000287", UserRole.STAFF);
    private static final AuthenticatedPrincipal C = actor("profile-b", "00000000-0000-0000-0000-000000000288", UserRole.MANAGER);
    private static final AuthenticatedPrincipal SUPER = actor("platform", "00000000-0000-0000-0000-000000000314", UserRole.SUPER_ADMIN);
    private static final AtomicBoolean ENABLED = new AtomicBoolean(true);
    private static AnnotationConfigApplicationContext context;
    private static HikariDataSource pool;
    private static JdbcTemplate owner;
    private OwnProfileService service;

    @BeforeAll
    static void prepareDatabaseAndTransactionalAdapters() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", APP_PASSWORD)).target("39").load().migrate();
        owner = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        owner.update("insert into tenant(id,name,slug,status,vertical) values ('profile-a','A','profile-a','ACTIVE','RESTAURANT'),('profile-b','B','profile-b','ACTIVE','RESTAURANT')");
        for (var actor : new AuthenticatedPrincipal[] {A, B, C, SUPER}) {
            owner.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'not-a-login-hash','Original',?)",
                    actor.id(), actor.tenantId().value(), storedEmail(actor), actor.role().name());
        }
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", APP_PASSWORD)).load().migrate();
        assertThat(owner.queryForMap("select contact_phone,preferred_language from app_user where id=?", A.id()))
                .containsEntry("contact_phone", null).containsEntry("preferred_language", null);
        pool = new HikariDataSource();
        pool.setJdbcUrl(POSTGRES.getJdbcUrl()); pool.setUsername("mapit_app"); pool.setPassword(APP_PASSWORD);
        pool.setMaximumPoolSize(1); pool.setMinimumIdle(1);
        context = new AnnotationConfigApplicationContext();
        context.register(Transactions.class);
        context.registerBean(DataSource.class, () -> pool);
        context.registerBean(JdbcTemplate.class, () -> new JdbcTemplate(pool));
        context.registerBean(PersonalProfileRepository.class, () -> new JdbcPersonalProfileRepository(context.getBean(JdbcTemplate.class)));
        context.registerBean(FeatureFlagPort.class, () -> new FeatureFlagPort() {
            @Override public boolean isEnabled(FeatureFlag flag) { return flag == FeatureFlag.MAPIT_S6_MY_ACCOUNT && ENABLED.get(); }
            @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) { return isEnabled(flag); }
        });
        context.registerBean(OwnProfileService.class);
        context.refresh();
    }

    @BeforeEach
    void resetFixture() {
        service = context.getBean(OwnProfileService.class); ENABLED.set(true);
        owner.update("update tenant set status='ACTIVE' where id in ('profile-a','profile-b','platform')");
        for (var actor : new AuthenticatedPrincipal[] {A, B, C, SUPER}) {
            owner.update("update app_user set active=true,role=?,full_name='Original' where id=?", actor.role().name(), actor.id());
        }
    }

    @AfterAll
    static void close() { if (context != null) context.close(); if (pool != null) pool.close(); }

    @Test
    void namePersistsAndDoesNotAlterAnotherUserTenantOrPrivilege() {
        assertThat(service.read(A).email()).isEqualTo(storedEmail(A)); // No confiar en email del claim.
        assertThat(service.updateFullName(A, "Nuevo nombre").fullName()).isEqualTo("Nuevo nombre");
        assertThat(service.read(A).fullName()).isEqualTo("Nuevo nombre");
        assertThat(service.read(B).fullName()).isEqualTo("Original");
        assertThat(service.read(C).fullName()).isEqualTo("Original");
        var row = owner.queryForMap("select tenant_id,email,role,active,password_hash from app_user where id=?", A.id());
        assertThat(row).containsEntry("tenant_id", "profile-a").containsEntry("email", storedEmail(A))
                .containsEntry("role", "ADMIN").containsEntry("active", true).containsEntry("password_hash", "not-a-login-hash");
    }

    @Test
    void optionalColumnsAcceptSupportedValuesAndRejectInvalidData() {
        owner.update("update app_user set contact_phone=null,preferred_language=null where id=?", A.id());
        var existing = owner.queryForMap("select contact_phone,preferred_language from app_user where id=?", A.id());
        assertThat(existing).containsEntry("contact_phone", null).containsEntry("preferred_language", null);
        owner.update("update app_user set contact_phone=?,preferred_language='ja-JP' where id=?", "1".repeat(32), A.id());
        for (String phone : new String[] {"", "abc", "+()-./", "1".repeat(33), "123\n"}) {
            assertThatThrownBy(() -> owner.update("update app_user set contact_phone=? where id=?", phone, A.id()))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        }
        for (String language : new String[] {"", "fr", "ES", "ja", "en-US"}) {
            assertThatThrownBy(() -> owner.update("update app_user set preferred_language=? where id=?", language, A.id()))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        }
        assertThat(owner.queryForObject("select relrowsecurity from pg_class where oid='app_user'::regclass", Boolean.class)).isTrue();
    }

    @Test
    void differentTenantInactiveAccountSuspendedTenantAndStaleRoleFailClosed() {
        rejected(() -> service.read(new AuthenticatedPrincipal(A.id(), C.tenantId(), A.email(), A.role())), Reason.UNAUTHENTICATED);
        owner.update("update app_user set active=false where id=?", A.id());
        rejected(() -> service.updateFullName(A, "Intruso"), Reason.UNAUTHENTICATED);
        owner.update("update app_user set active=true,role='STAFF' where id=?", A.id());
        rejected(() -> service.read(A), Reason.UNAUTHENTICATED);
        owner.update("update tenant set status='SUSPENDED' where id='profile-b'");
        rejected(() -> service.read(C), Reason.UNAUTHENTICATED);
    }

    @Test
    void platformIsAnOwnAccountAndOffNeverChangesTheDatabase() {
        assertThat(service.updateFullName(SUPER, "Mi plataforma").fullName()).isEqualTo("Mi plataforma");
        ENABLED.set(false);
        rejected(() -> service.updateFullName(A, "No guardar"), Reason.DISABLED);
        assertThat(owner.queryForObject("select full_name from app_user where id=?", String.class, A.id())).isEqualTo("Original");
    }

    @Test
    void runtimeHasNoBypassAndPoolDoesNotRetainTenantBetweenTransactions() {
        var jdbc = context.getBean(JdbcTemplate.class);
        var tx = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
        tx.executeWithoutResult(status -> {
            assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
            assertThat(jdbc.queryForObject("select rolbypassrls or rolsuper from pg_roles where rolname=current_user", Boolean.class)).isFalse();
            jdbc.queryForObject("select set_config('app.tenant_id','',true)", String.class);
            jdbc.queryForObject("select set_config('app.login_email','',true)", String.class);
            assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
        });
        service.read(A);
        tx.executeWithoutResult(status -> {
            assertThat(jdbc.queryForObject("select current_tenant_id()", String.class)).isNull();
            assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
        });
        assertThat(service.read(C).email()).isEqualTo(storedEmail(C));
    }

    private static void rejected(Runnable action, Reason reason) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(OwnProfileFailure.class, failure -> assertThat(failure.reason()).isEqualTo(reason));
    }
    private static String storedEmail(AuthenticatedPrincipal actor) { return actor.id() + "@stored.example.test"; }
    private static AuthenticatedPrincipal actor(String tenant, String id, UserRole role) {
        return new AuthenticatedPrincipal(UUID.fromString(id), TenantId.of(tenant), "claim@example.test", role);
    }
    @Configuration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class Transactions {
        @Bean PlatformTransactionManager transactionManager(DataSource dataSource) { return new DataSourceTransactionManager(dataSource); }
    }
}
