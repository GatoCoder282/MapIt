package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.identity.application.OwnProfileService;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileChanges;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.json.JsonMapper;

class MyAccountControllerTest {
    private static final AuthenticatedPrincipal A = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("tenant-a"), "a@example.test", UserRole.ADMIN);
    private static final PersonalProfile PROFILE = new PersonalProfile("Nombre actual", A.email());
    private final PersonalProfileRepository repository = mock(PersonalProfileRepository.class);
    private final FeatureFlagPort flags = mock(FeatureFlagPort.class);
    private RestTestClient client;

    @BeforeEach
    void setUp() {
        when(repository.findOwn(A)).thenReturn(Optional.of(PROFILE));
        when(repository.updateOwn(eq(A), any())).thenAnswer(call -> {
            PersonalProfileChanges change = call.getArgument(1);
            return Optional.of(new PersonalProfile(java.util.Objects.requireNonNull(change.fullName().applyTo(PROFILE.fullName())), PROFILE.email(), change.contactPhone().applyTo(PROFILE.contactPhone()), change.preferredLanguage().applyTo(PROFILE.preferredLanguage())));
        });
        when(flags.isEnabledFor(FeatureFlag.MAPIT_S6_MY_ACCOUNT, A.tenantId())).thenReturn(true);
        var mapper = JsonMapper.builder().changeDefaultPropertyInclusion(value -> value.withValueInclusion(JsonInclude.Include.NON_NULL))
                .addModule(new PersonalProfileJsonConfiguration().personalProfileJsonModule()).build();
        client = RestTestClient.bindToController(new MyAccountController(new OwnProfileService(repository, flags)))
                .configureServer(builder -> builder.setMessageConverters(new JacksonJsonHttpMessageConverter(mapper))).build();
        authenticate(A);
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void readsRealFieldsWithoutInventingContactOrLanguage() {
        client.get().uri("/api/v1/me").exchange().expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.fullName").isEqualTo(PROFILE.fullName())
                .jsonPath("$.email").isEqualTo(A.email())
                .jsonPath("$.contactPhone").hasJsonPath().jsonPath("$.preferredLanguage").hasJsonPath()
                .jsonPath("$.role").doesNotExist().jsonPath("$.tenantId").doesNotExist()
                .jsonPath("$.passwordHash").doesNotExist();
        verify(repository).findOwn(A);
    }

    @Test
    void persistsOnlyTheOwnNameAndReturnsThePersistedProjection() {
        when(repository.updateOwn(A, PersonalProfileChanges.name("Nombre nuevo"))).thenReturn(Optional.of(new PersonalProfile("Nombre nuevo", A.email())));
        patch("{\"fullName\":\"Nombre nuevo\"}").expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.fullName").isEqualTo("Nombre nuevo").jsonPath("$.email").isEqualTo(A.email());
        verify(repository).updateOwn(A, PersonalProfileChanges.name("Nombre nuevo"));
    }

    @Test
    void missingOrUntrustedPrincipalDoesNotReachPersistence() {
        SecurityContextHolder.clearContext();
        client.get().uri("/api/v1/me").exchange().expectStatus().isUnauthorized();
        patch("{\"fullName\":\"Nombre\"}").expectStatus().isUnauthorized();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("client-user-id", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        client.get().uri("/api/v1/me").exchange().expectStatus().isUnauthorized();
        verifyNoInteractions(repository, flags);
    }

    @ParameterizedTest
    @ValueSource(strings = {"userId", "id", "tenantId", "tenantSlug", "email", "role", "roles", "memberships", "permissions", "privileges", "active", "status", "administrativeState", "unknown"})
    void privilegedOrUnknownPropertiesRejectTheWholeBody(String property) {
        patch("{\"fullName\":\"Nombre\",\"" + property + "\":\"otro\"}")
                .expectStatus().isBadRequest().expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.type").isEqualTo("https://mapit.local/problems/invalid-request");
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "[]", "{}", "{", "{\"fullName\":null}", "{\"fullName\":9}", "{\"fullName\":\" \"}", "{\"preferredLanguage\":\"fr\"}", "{\"contactPhone\":true}", "{\"contactPhone\":\"\"}", "{\"contactPhone\":\"abc\"}"})
    void malformedBodiesAndInvalidValuesDoNotWrite(String body) {
        patch(body).expectStatus().isBadRequest().expectHeader().valueEquals("Cache-Control", "no-store");
        verify(repository, never()).updateOwn(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"contactPhone\":null}", "{\"preferredLanguage\":null}", "{\"contactPhone\":\"+591 70000000\"}", "{\"preferredLanguage\":\"ja-JP\"}", "{\"fullName\":\"No guardar\",\"preferredLanguage\":\"en\"}"})
    void optionalFieldsPersistWithoutPartialSuccess(String body) {
        patch(body).expectStatus().isOk().expectHeader().valueEquals("Cache-Control", "no-store");
        verify(repository).updateOwn(eq(A), any());
    }

    @Test
    void targetIdsInQueryCannotSelectOtherUsersOfSameOrOtherTenant() {
        for (String target : List.of(UUID.randomUUID().toString(), "tenant-b")) {
            client.get().uri("/api/v1/me?userId=" + target).exchange().expectStatus().isBadRequest();
            client.patch().uri("/api/v1/me?tenantId=" + target).contentType(MediaType.APPLICATION_JSON)
                    .body("{\"fullName\":\"Intruso\"}").exchange().expectStatus().isBadRequest();
        }
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"X-User-Id", "X-Tenant-Id", "X-Tenant-Slug", "X-Role"})
    void identityHeadersCannotOverrideThePrincipal(String header) {
        client.get().uri("/api/v1/me").header(header, "other-user-or-tenant").exchange().expectStatus().isBadRequest();
        verifyNoInteractions(repository);
    }

    @Test
    void flagOffAndAccountNoLongerEligibleNeverWrite() {
        when(flags.isEnabledFor(FeatureFlag.MAPIT_S6_MY_ACCOUNT, A.tenantId())).thenReturn(false);
        client.get().uri("/api/v1/me").exchange().expectStatus().isNotFound();
        patch("{\"fullName\":\"Nombre\"}").expectStatus().isNotFound();
        patch("{\"preferredLanguage\":null}").expectStatus().isNotFound();
        when(repository.findOwn(A)).thenReturn(Optional.empty());
        client.get().uri("/api/v1/me").exchange().expectStatus().isUnauthorized();
        verify(repository, never()).updateOwn(any(), any());
    }

    @Test
    void conflictAndPersistenceFailureReturnSafeProblems() {
        when(repository.updateOwn(eq(A), any())).thenReturn(Optional.empty());
        patch("{\"fullName\":\"Nombre\"}").expectStatus().isEqualTo(409);
        when(repository.findOwn(A)).thenThrow(new DataAccessResourceFailureException("private-sql-and-credentials"));
        var result = client.get().uri("/api/v1/me").exchange().expectStatus().isEqualTo(503)
                .expectBody(String.class).returnResult().getResponseBody();
        assertThat(result).doesNotContain("private-sql-and-credentials");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"fullName\":\"Nombre\",\"contactPhone\":null}",
            "{\"fullName\":\"Nombre\",\"preferredLanguage\":null}",
            "{\"fullName\":\"Nombre\",\"contactPhone\":\"+591 123\",\"preferredLanguage\":\"ja-JP\"}"
    })
    void validOptionalFieldsAreWrittenTogether(String body) {
        patch(body).expectStatus().isOk().expectBody().jsonPath("$.fullName").isEqualTo("Nombre");
        verify(repository).updateOwn(eq(A), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"fullName\":null,\"contactPhone\":\"123\"}",
            "{\"fullName\":\"Nombre\",\"contactPhone\":\"123\",\"preferredLanguage\":\"fr\"}",
            "{\"fullName\":\"Nombre\",\"contactPhone\":null,\"preferredLanguage\":true}",
            "{\"fullName\":\"Nombre\",\"contactPhone\":\"\",\"preferredLanguage\":\"es\"}",
            "{\"fullName\":\"Nombre\",\"contactPhone\":null,\"role\":\"SUPER_ADMIN\"}"
    })
    void validatesWholePatchBeforeAnyPersistenceOrUnavailableResponse(String body) {
        patch(body).expectStatus().isBadRequest();
        verifyNoInteractions(repository);
    }

    private RestTestClient.ResponseSpec patch(String body) {
        return client.patch().uri("/api/v1/me").contentType(MediaType.APPLICATION_JSON).body(body).exchange();
    }

    private static void authenticate(AuthenticatedPrincipal actor) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + actor.role().name()))));
    }
}
