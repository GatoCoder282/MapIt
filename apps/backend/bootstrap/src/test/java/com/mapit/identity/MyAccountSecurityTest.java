package com.mapit.identity;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;

import com.mapit.config.SecurityConfig;
import com.mapit.identity.application.ChangeOwnPassword;
import com.mapit.identity.application.CommitOwnPasswordChange;
import com.mapit.identity.application.OwnProfileService;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.CurrentStaffIdentity;
import com.mapit.identity.domain.OwnPasswordAttemptLimiter;
import com.mapit.identity.domain.OwnPasswordRateLimited;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileChanges;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JjwtTokenService;
import com.mapit.identity.infrastructure.JwtAuthenticationFilter;
import com.mapit.identity.infrastructure.MyAccountController;
import com.mapit.identity.infrastructure.MyPasswordController;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/** Cadena real y JWT firmados, con REST en memoria: no Spring Boot, servidor ni BD. */
class MyAccountSecurityTest {
    private static final String SECRET = "test-my-account-secret-012345678901234567890123456789";
    private static final Instant NOW = Instant.parse("2026-11-21T12:00:00Z");
    private static final AuthenticatedPrincipal A = actor("tenant-a", UserRole.ADMIN);
    private static final AuthenticatedPrincipal B = actor("tenant-a", UserRole.STAFF);
    private static final AuthenticatedPrincipal C = actor("tenant-b", UserRole.MANAGER);
    private static final AuthenticatedPrincipal SUPER = actor("platform", UserRole.SUPER_ADMIN);
    private static final Map<AuthenticatedPrincipal, PersonalProfile> PROFILES = Map.of(
            A, new PersonalProfile("Cuenta A", A.email()), B, new PersonalProfile("Cuenta B", B.email()),
            C, new PersonalProfile("Cuenta C", C.email()), SUPER, new PersonalProfile("Plataforma", SUPER.email()));
    private AnnotationConfigWebApplicationContext context;
    private RestTestClient client;
    private PersonalProfileRepository repository;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of("mapit.cors.allowed-origins", "http://localhost:4200")));
        context.register(SecurityConfig.class, Fixture.class);
        context.refresh();
        repository = context.getBean(PersonalProfileRepository.class);
        client = RestTestClient.bindToController(new MyAccountController(context.getBean(OwnProfileService.class)),
                new MyPasswordController(context.getBean(ChangeOwnPassword.class)))
                .configureServer(builder -> builder.addFilters(context.getBean(FilterChainProxy.class))).build();
    }

    @AfterEach
    void close() {
        context.close();
        SecurityContextHolder.clearContext();
    }

    @Test
    void unauthenticatedInvalidAndExpiredJwtAreRejectedEvenWhenFlagOff() {
        for (boolean enabled : new boolean[] {false, true}) {
            context.getBean(AtomicBoolean.class).set(enabled);
        client.get().uri("/api/v1/me").exchange().expectStatus().isUnauthorized();
        client.patch().uri("/api/v1/me").contentType(MediaType.APPLICATION_JSON).body("{\"fullName\":\"Nombre\"}")
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/v1/me/password").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isUnauthorized();
        read("altered.jwt.value").expectStatus().isUnauthorized();
        var expired = new JjwtTokenService(SECRET, "mapit-profile-test", 15, Clock.fixed(NOW.minusSeconds(3600), ZoneOffset.UTC));
        read(token(expired, A)).expectStatus().isUnauthorized();
        }
        verify(repository, never()).findOwn(any());
    }

    @Test
    void flagDoesNotGrantPlatformPrivilegesInEitherState() {
        var invalidRole = new AuthenticatedPrincipal(A.id(), TenantId.of("platform"), A.email(), UserRole.ADMIN);
        for (boolean enabled : new boolean[] {false, true}) {
            context.getBean(AtomicBoolean.class).set(enabled);
            read(token(invalidRole)).expectStatus().isUnauthorized();
            client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(invalidRole))
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("fullName", "Intruso"))
                    .exchange().expectStatus().isUnauthorized();
        }
        verify(repository, never()).findOwn(any());
        verify(repository, never()).updateOwn(any(), any());
    }

    @Test
    void passwordEndpointRejectsUnknownIdentityAndDoesNotEchoSecrets() {
        for (boolean enabled : new boolean[] {false, true}) {
            context.getBean(AtomicBoolean.class).set(enabled);
            client.post().uri("/api/v1/me/password").header("Authorization", "Bearer " + token(A))
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("currentPassword", "private-current-canary",
                            "newPassword", "private-next-canary", "newPasswordConfirm", "private-confirm-canary", "userId", B.id().toString()))
                    .exchange().expectStatus().isBadRequest().expectBody().consumeWith(response -> {
                        var body = response.getResponseBody();
                        if (body != null) org.assertj.core.api.Assertions.assertThat(new String(body, java.nio.charset.StandardCharsets.UTF_8))
                                .doesNotContain("private-current-canary", "private-next-canary", "private-confirm-canary");
                    });
        }
        verify(repository, never()).findOwn(any());
        verify(repository, never()).updateOwn(any(), any());
    }

    @Test
    void passwordRequiresOwnEligibleIdentityAndFlagAndNeverReturnsAToken() {
        password(A).expectStatus().isNotFound();
        verify(context.getBean(CommitOwnPasswordChange.class), never()).execute(any(), any());
        context.getBean(AtomicBoolean.class).set(true);
        for (var principal : PROFILES.keySet()) {
            password(principal).expectStatus().isNoContent().expectHeader().valueEquals("Cache-Control", "no-store")
                    .expectBody().isEmpty();
            verify(context.getBean(CommitOwnPasswordChange.class)).execute(org.mockito.ArgumentMatchers.eq(principal), any());
        }
        password(new AuthenticatedPrincipal(A.id(), C.tenantId(), A.email(), A.role(), NOW))
                .expectStatus().isUnauthorized();
        when(repository.findOwn(A)).thenReturn(Optional.empty());
        password(A).expectStatus().isUnauthorized();
    }

    @Test
    void passwordRateLimitAndDatabaseFailuresAreSafeAndDoNotReturnFalseSuccess() {
        context.getBean(AtomicBoolean.class).set(true);
        var limiter = context.getBean(OwnPasswordAttemptLimiter.class);
        org.mockito.Mockito.doThrow(new OwnPasswordRateLimited(900)).when(limiter).checkPasswordChange(any(), any());
        password(A).expectStatus().isEqualTo(429).expectHeader().valueEquals("Retry-After", "900");
        verify(context.getBean(CommitOwnPasswordChange.class), never()).execute(any(), any());
        org.mockito.Mockito.reset(limiter);
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("private-canary"))
                .when(context.getBean(CommitOwnPasswordChange.class)).execute(any(), any());
        password(A).expectStatus().isEqualTo(503).expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().consumeWith(response -> org.assertj.core.api.Assertions.assertThat(
                        new String(response.getResponseBody(), java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("private-canary", "CurrentSecret1!", "NewSecret2!"));
    }

    private RestTestClient.ResponseSpec password(AuthenticatedPrincipal actor) {
        return client.post().uri("/api/v1/me/password").header("Authorization", "Bearer " + token(actor))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("currentPassword", "CurrentSecret1!", "newPassword", "NewSecret2!", "newPasswordConfirm", "NewSecret2!")).exchange();
    }

    @Test
    void defaultOffAndOnDoNotBypassAccountEligibility() {
        read(token(A)).expectStatus().isNotFound();
        context.getBean(AtomicBoolean.class).set(true);
        read(token(A)).expectStatus().isOk();
        when(repository.findOwn(A)).thenReturn(Optional.empty());
        read(token(A)).expectStatus().isUnauthorized();
        context.getBean(AtomicBoolean.class).set(false);
        read(token(A)).expectStatus().isUnauthorized();
    }

    @Test
    void allStaffRolesAndSuperAdminReadOnlyTheirOwnProjection() {
        context.getBean(AtomicBoolean.class).set(true);
        for (var principal : PROFILES.keySet()) {
            read(token(principal)).expectStatus().isOk().expectHeader().valueEquals("Cache-Control", "no-store")
                    .expectBody().jsonPath("$.email").isEqualTo(principal.email()).jsonPath("$.role").doesNotExist();
        }
    }

    @Test
    void signedJwtWithDifferentRoleOrTenantDoesNotSelectAnotherAccount() {
        context.getBean(AtomicBoolean.class).set(true);
        read(token(new AuthenticatedPrincipal(A.id(), A.tenantId(), A.email(), UserRole.STAFF))).expectStatus().isUnauthorized();
        read(token(new AuthenticatedPrincipal(A.id(), C.tenantId(), A.email(), A.role()))).expectStatus().isUnauthorized();
        read(token(new AuthenticatedPrincipal(SUPER.id(), A.tenantId(), SUPER.email(), UserRole.SUPER_ADMIN))).expectStatus().isUnauthorized();
    }

    @Test
    void queryBodyAndHeadersCannotTargetUsersInTheSameOrAnotherTenant() {
        context.getBean(AtomicBoolean.class).set(true);
        for (var target : new AuthenticatedPrincipal[] {B, C}) {
            client.get().uri("/api/v1/me?userId=" + target.id()).header("Authorization", "Bearer " + token(A))
                    .exchange().expectStatus().isBadRequest();
            client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(A))
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("fullName", "Intruso", "userId", target.id().toString()))
                    .exchange().expectStatus().isBadRequest();
            client.get().uri("/api/v1/me").header("Authorization", "Bearer " + token(A))
                    .header("X-Tenant-Id", target.tenantId().value()).exchange().expectStatus().isBadRequest();
        }
        verify(repository, never()).updateOwn(any(), any());
    }

    @Test
    void flagOffPreventsPatchAndFlagOnAllowsOnlyOwnName() {
        client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(A)).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("fullName", "Nuevo")).exchange().expectStatus().isNotFound();
        verify(repository, never()).updateOwn(any(), any());
        context.getBean(AtomicBoolean.class).set(true);
        when(repository.updateOwn(A, PersonalProfileChanges.name("Nuevo"))).thenReturn(Optional.of(new PersonalProfile("Nuevo", A.email())));
        client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(A)).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("fullName", "Nuevo")).exchange().expectStatus().isOk();
        verify(repository).updateOwn(A, PersonalProfileChanges.name("Nuevo"));
    }

    @Test
    void currentIdentityRejectionOrFailurePrecedesProfileAccessEvenWithAValidJwt() {
        var identities = context.getBean(CurrentStaffIdentity.class);
        for (boolean enabled : new boolean[] {false, true}) {
            context.getBean(AtomicBoolean.class).set(enabled);
            org.mockito.Mockito.doReturn(Optional.empty()).when(identities).resolve(any());
            read(token(A)).expectStatus().isUnauthorized();
            org.mockito.Mockito.doThrow(new IllegalStateException("identity-provider-test")).when(identities).resolve(any());
            client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(A))
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("fullName", "Nuevo"))
                    .exchange().expectStatus().isUnauthorized();
            org.mockito.Mockito.reset(identities);
        }
        verify(repository, never()).findOwn(any());
        verify(repository, never()).updateOwn(any(), any());
    }

    @Test
    void optionalFieldsUseTheSameValidatedIdentityForEverySupportedRole() {
        context.getBean(AtomicBoolean.class).set(true);
        for (var actor : PROFILES.keySet()) {
            var profile = PROFILES.get(actor);
            when(repository.updateOwn(org.mockito.ArgumentMatchers.eq(actor), any()))
                    .thenReturn(Optional.of(new PersonalProfile(profile.fullName(), profile.email(), "123", "ja-JP")));
            client.patch().uri("/api/v1/me").header("Authorization", "Bearer " + token(actor)).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("contactPhone", "123", "preferredLanguage", "ja-JP")).exchange().expectStatus().isOk()
                    .expectBody().jsonPath("$.contactPhone").isEqualTo("123").jsonPath("$.preferredLanguage").isEqualTo("ja-JP")
                    .jsonPath("$.email").isEqualTo(actor.email()).jsonPath("$.role").doesNotExist();
            verify(repository).updateOwn(org.mockito.ArgumentMatchers.eq(actor), any());
        }
    }

    private RestTestClient.ResponseSpec read(String jwt) {
        return client.get().uri("/api/v1/me").header("Authorization", "Bearer " + jwt).exchange();
    }

    private String token(AuthenticatedPrincipal principal) { return token(context.getBean(JjwtTokenService.class), principal); }
    private static String token(JjwtTokenService tokens, AuthenticatedPrincipal principal) {
        return tokens.issue(new AuthenticatedUser(principal.id(), principal.tenantId(), principal.email(), "Token name", principal.role())).value();
    }
    private static AuthenticatedPrincipal actor(String tenant, UserRole role) {
        UUID id = UUID.randomUUID();
        return new AuthenticatedPrincipal(id, TenantId.of(tenant), id + "@example.test", role, NOW);
    }

    @Configuration
    static class Fixture {
        @Bean JjwtTokenService tokens() { return new JjwtTokenService(SECRET, "mapit-profile-test", 15, Clock.fixed(NOW, ZoneOffset.UTC)); }
        @Bean JwtAuthenticationFilter jwtFilter(JjwtTokenService tokens, CurrentStaffIdentity identities) { return new JwtAuthenticationFilter(tokens, identities); }
        /** Doble solo de test: modela identidad vigente sin saltar la nueva etapa del filtro real. */
        @Bean CurrentStaffIdentity identities() {
            var identities = mock(CurrentStaffIdentity.class);
            when(identities.resolve(any())).thenAnswer(call -> {
                AuthenticatedPrincipal signed = call.getArgument(0);
                return PROFILES.keySet().stream()
                        .filter(current -> current.id().equals(signed.id()) && current.tenantId().equals(signed.tenantId()) && current.role() == signed.role())
                        .filter(current -> (current.role() == UserRole.SUPER_ADMIN) == "platform".equals(current.tenantId().value()))
                        .map(current -> new AuthenticatedPrincipal(current.id(), current.tenantId(), current.email(), current.role(), signed.issuedAt()))
                        .findFirst();
            });
            return identities;
        }
        @Bean AtomicBoolean enabled() { return new AtomicBoolean(false); }
        @Bean FeatureFlagPort flags(AtomicBoolean enabled) {
            return new FeatureFlagPort() {
                @Override public boolean isEnabled(FeatureFlag flag) { return flag == FeatureFlag.MAPIT_S6_MY_ACCOUNT && enabled.get(); }
                @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) { return isEnabled(flag); }
            };
        }
        @Bean PersonalProfileRepository profiles() {
            var repository = mock(PersonalProfileRepository.class);
            when(repository.findOwn(any())).thenAnswer(call -> Optional.ofNullable(PROFILES.get(call.getArgument(0))));
            return repository;
        }
        @Bean OwnProfileService service(PersonalProfileRepository repository, FeatureFlagPort flags) { return new OwnProfileService(repository, flags); }
        @Bean OwnPasswordAttemptLimiter passwordLimiter() { return mock(OwnPasswordAttemptLimiter.class); }
        @Bean CommitOwnPasswordChange passwordWriter() { return mock(CommitOwnPasswordChange.class); }
        @Bean ChangeOwnPassword passwords(OwnProfileService profiles, OwnPasswordAttemptLimiter limiter, CommitOwnPasswordChange writer) { return new ChangeOwnPassword(profiles, limiter, writer); }
    }
}
