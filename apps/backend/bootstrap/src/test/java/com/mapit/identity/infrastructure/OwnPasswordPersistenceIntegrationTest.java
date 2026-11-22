package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.application.*;
import com.mapit.identity.domain.*;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;
import com.zaxxer.hikari.HikariDataSource;

/** PostgreSQL/RLS y transacciones reales; sin Boot ni servidor. Requiere Docker, no ejecutar sin autorización. */
@Tag("integration")
@Testcontainers
class OwnPasswordPersistenceIntegrationTest {
    private static final String APP_PASSWORD = "password_test_app_secret";
    private static final String ORIGINAL = "OriginalSecret1!";
    private static final String NEXT = "ReplacementSecret2!";
    private static final UUID A = UUID.fromString("00000000-0000-0000-0000-000000000289");
    private static final UUID B = UUID.fromString("00000000-0000-0000-0000-000000000290");
    private static final UUID C = UUID.fromString("00000000-0000-0000-0000-000000000291");
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);
    private static final AtomicReference<Gate> SIGNING = new AtomicReference<>();
    private static final AtomicReference<Gate> HASHING = new AtomicReference<>();
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("mapit_passwords").withUsername("mapit").withPassword("test_owner_password");
    private static AnnotationConfigApplicationContext context;
    private static JdbcTemplate owner;
    private static HikariDataSource pool;
    private AuthenticatedPrincipal actor;

    @BeforeAll static void configureRealAdapters() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", APP_PASSWORD)).load().migrate();
        owner = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        owner.update("insert into tenant(id,name,slug,status,vertical) values ('password-a','A','password-a','ACTIVE','RESTAURANT'),('password-b','B','password-b','ACTIVE','RESTAURANT')");
        for (var id : new UUID[] {A,B,C}) {
            owner.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,?,?,?,'Staff','ADMIN')",
                    id, id.equals(C) ? "password-b" : "password-a", email(id), ENCODER.encode(ORIGINAL));
        }
        pool = new HikariDataSource(); pool.setJdbcUrl(POSTGRES.getJdbcUrl()); pool.setUsername("mapit_app");
        pool.setPassword(APP_PASSWORD); pool.setMaximumPoolSize(5);
        context = new AnnotationConfigApplicationContext(); context.register(Transactions.class);
        context.registerBean(DataSource.class, () -> pool);
        context.registerBean(JdbcTemplate.class, () -> new JdbcTemplate(pool));
        context.registerBean(JdbcPersonalProfileRepository.class); context.registerBean(JdbcOwnPasswordRepository.class);
        context.registerBean(JdbcUserCredentialsRepository.class); context.registerBean(JdbcCurrentStaffIdentity.class);
        context.registerBean(AuthAttemptLimiter.class, () -> new AuthAttemptLimiter(context.getBean(JdbcTemplate.class), "test-limiter-secret"));
        context.registerBean(FeatureFlagPort.class, () -> new FeatureFlagPort() {
            @Override public boolean isEnabled(FeatureFlag flag) { return flag == FeatureFlag.MAPIT_S6_MY_ACCOUNT; }
            @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) { return isEnabled(flag); }
        });
        context.registerBean(PasswordVerifier.class, () -> new BCryptPasswordVerifier(ENCODER));
        context.registerBean(PasswordHasher.class, () -> value -> { pause(HASHING); return ENCODER.encode(value); });
        context.registerBean(JjwtTokenService.class, () -> new JjwtTokenService("test-password-secret-012345678901234567890123456789", "password-test", 15, java.time.Clock.systemUTC()));
        context.registerBean(AccessTokenIssuer.class, () -> new AccessTokenIssuer() {
            @Override public IssuedAccessToken issue(AuthenticatedUser user) { return context.getBean(JjwtTokenService.class).issue(user); }
            @Override public IssuedAccessToken issue(AuthenticatedUser user, Instant at) { pause(SIGNING); return context.getBean(JjwtTokenService.class).issue(user, at); }
        }, definition -> definition.setPrimary(true));
        context.registerBean(OwnProfileService.class); context.registerBean(OwnPasswordChangeValidator.class);
        context.registerBean(CommitOwnPasswordChange.class); context.registerBean(ChangeOwnPassword.class);
        context.registerBean(AuthenticateUser.class); context.registerBean(IssueAccessToken.class); context.registerBean(OpenStaffSession.class);
        context.refresh();
    }

    @BeforeEach void reset() {
        SIGNING.set(null); HASHING.set(null);
        owner.update("delete from auth_attempt_limit");
        owner.update("update app_user set password_hash=?,staff_tokens_valid_after=null where id in (?,?,?)", ENCODER.encode(ORIGINAL), A,B,C);
        var now = owner.queryForObject("select clock_timestamp()", java.sql.Timestamp.class).toInstant();
        actor = new AuthenticatedPrincipal(A, TenantId.of("password-a"), email(A), UserRole.ADMIN, now.minusSeconds(60));
    }
    @AfterAll static void close() { if (context != null) context.close(); if (pool != null) pool.close(); }

    @Test void atomicChangeRevokesOldIdentityAndLeavesOtherUsersTenantsAndAuthorityUntouched() {
        var before = owner.queryForMap("select tenant_id,email,role,active from app_user where id=?", A);
        change(actor, ORIGINAL);
        assertThat(ENCODER.matches(NEXT, hash(A))).isTrue();
        assertThat(ENCODER.matches(ORIGINAL, hash(B))).isTrue(); assertThat(ENCODER.matches(ORIGINAL, hash(C))).isTrue();
        assertThat(owner.queryForMap("select tenant_id,email,role,active from app_user where id=?", A)).isEqualTo(before);
        assertThat(context.getBean(JdbcCurrentStaffIdentity.class).resolve(actor)).isEmpty();
        assertThatThrownBy(() -> login(ORIGINAL)).isInstanceOf(InvalidCredentialsException.class);
        // Espera acotada de la barrera del siguiente segundo, sin relajar iat > corte.
        var deadline = Instant.now().plusSeconds(3); OpenStaffSession.Session session = null;
        while (session == null && Instant.now().isBefore(deadline)) {
            try { session = login(NEXT); } catch (TokenIssuanceNotReady retry) { sleep(30); }
        }
        assertThat(session).isNotNull();
        var signed = context.getBean(JjwtTokenService.class).verify(session.token().value()).orElseThrow();
        assertThat(context.getBean(JdbcCurrentStaffIdentity.class).resolve(signed)).isPresent();
    }

    @Test void rejectionRollsBackAndFailedAttemptsPersistInSeparateBudget() {
        var original = hash(A);
        for (int i=0;i<5;i++) assertThatThrownBy(() -> change(actor, "WrongSecret1!"))
                .isInstanceOf(OwnPasswordChangeFailure.class);
        assertThatThrownBy(() -> change(actor, ORIGINAL)).isInstanceOf(OwnPasswordRateLimited.class);
        assertThat(hash(A)).isEqualTo(original);
        assertThat(owner.queryForObject("select staff_tokens_valid_after from app_user where id=?", java.sql.Timestamp.class, A)).isNull();
    }

    @Test void wrongTenantCannotReadOrChangeCredential() {
        var wrong = new AuthenticatedPrincipal(A, TenantId.of("password-b"), email(A), UserRole.ADMIN, actor.issuedAt());
        assertThatThrownBy(() -> change(wrong, ORIGINAL)).isInstanceOf(OwnProfileFailure.class);
        assertThat(ENCODER.matches(ORIGINAL, hash(A))).isTrue();
    }

    @Test void transactionRollbackRestoresBothHashAndCutoff() {
        var original = hash(A);
        var tx = new org.springframework.transaction.support.TransactionTemplate(context.getBean(PlatformTransactionManager.class));
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            change(actor, ORIGINAL);
            throw new IllegalStateException("rollback-test");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(hash(A)).isEqualTo(original);
        assertThat(owner.queryForObject("select staff_tokens_valid_after from app_user where id=?", java.sql.Timestamp.class, A)).isNull();
        assertThat(owner.queryForObject("select count(*) from auth_attempt_limit", Integer.class)).isEqualTo(2);
    }

    @Test void loginAlreadyVerifiedMustFinishSigningBeforePasswordCanCommit() throws Exception {
        var gate = new Gate(); SIGNING.set(gate);
        try (var threads = Executors.newVirtualThreadPerTaskExecutor()) {
            var login = threads.submit(() -> login(ORIGINAL));
            assertThat(gate.entered.await(3, TimeUnit.SECONDS)).isTrue();
            var changing = threads.submit(() -> change(actor, ORIGINAL));
            try { assertDatabaseLockWait(changing); } finally { gate.release.countDown(); }
            var issued = login.get(5, TimeUnit.SECONDS); changing.get(5, TimeUnit.SECONDS);
            var signed = context.getBean(JjwtTokenService.class).verify(issued.token().value()).orElseThrow();
            assertThat(context.getBean(JdbcCurrentStaffIdentity.class).resolve(signed)).isEmpty();
        } finally { gate.release.countDown(); SIGNING.set(null); }
    }

    @Test void loginWaitingBehindChangeRechecksNewHashAndCannotIssueFromOldPassword() throws Exception {
        var gate = new Gate(); HASHING.set(gate);
        try (var threads = Executors.newVirtualThreadPerTaskExecutor()) {
            var changing = threads.submit(() -> change(actor, ORIGINAL));
            assertThat(gate.entered.await(3, TimeUnit.SECONDS)).isTrue();
            var login = threads.submit(() -> login(ORIGINAL));
            try { assertDatabaseLockWait(login); } finally { gate.release.countDown(); }
            changing.get(5, TimeUnit.SECONDS);
            assertThatThrownBy(() -> login.get(5, TimeUnit.SECONDS)).hasCauseInstanceOf(InvalidCredentialsException.class);
        } finally { gate.release.countDown(); HASHING.set(null); }
    }

    private void change(AuthenticatedPrincipal principal, String current) { context.getBean(ChangeOwnPassword.class).execute(principal, new OwnPasswordChange(current,NEXT,NEXT), "127.0.0.1"); }
    private OpenStaffSession.Session login(String password) { return context.getBean(OpenStaffSession.class).execute(new AuthenticateUserCommand(email(A), password)); }
    private static String hash(UUID id) { return owner.queryForObject("select password_hash from app_user where id=?", String.class, id); }
    private static String email(UUID id) { return id+"@password.test"; }
    private static void assertDatabaseLockWait(Future<?> pending) {
        var deadline = Instant.now().plusSeconds(3);
        while (Instant.now().isBefore(deadline)) {
            if (owner.queryForObject("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%for update%'", Integer.class) > 0) {
                assertThat(pending.isDone()).isFalse(); return;
            }
            sleep(20);
        }
        throw new AssertionError("No se observó el bloqueo de fila esperado");
    }
    private static void pause(AtomicReference<Gate> ref) { var gate=ref.getAndSet(null); if(gate!=null) { gate.entered.countDown(); try { if(!gate.release.await(5,TimeUnit.SECONDS)) throw new AssertionError("Barrera agotada"); } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); } } }
    private static void sleep(long millis) { try { Thread.sleep(millis); } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); } }
    private static final class Gate { final CountDownLatch entered=new CountDownLatch(1); final CountDownLatch release=new CountDownLatch(1); }
    @Configuration @EnableTransactionManagement(proxyTargetClass=true)
    static class Transactions { @Bean PlatformTransactionManager transactions(DataSource source) { return new DataSourceTransactionManager(source); } }
}
