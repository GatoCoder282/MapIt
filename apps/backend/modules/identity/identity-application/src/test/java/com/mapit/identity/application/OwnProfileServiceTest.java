package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.identity.application.OwnProfileFailure.Reason;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileChanges;
import com.mapit.identity.domain.PersonalProfileChanges.Field;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

class OwnProfileServiceTest {
    @Test
    void persistsPresentFieldsTogetherPreservesAbsentAndClearsOnlyOptionalFields() {
        var profiles = new Profiles(); var flags = new Flags(); var actor = account("tenant-a", UserRole.ADMIN);
        var other = account("tenant-a", UserRole.STAFF); var cross = account("tenant-b", UserRole.ADMIN);
        profiles.add(actor, "Original"); profiles.add(other, "Other"); profiles.add(cross, "Cross");
        var service = new OwnProfileService(profiles, flags);
        var first = service.update(actor, new OwnProfilePatch(Field.absent(),
                Field.provided("+591 123"), Field.provided("ja-JP")));
        assertThat(first).isEqualTo(new PersonalProfile("Original", actor.email(), "+591 123", "ja-JP"));
        assertThat(service.updateFullName(actor, "Nuevo")).isEqualTo(new PersonalProfile("Nuevo", actor.email(), "+591 123", "ja-JP"));
        var cleared = service.update(actor, new OwnProfilePatch(Field.absent(),
                Field.provided(null), Field.provided(null)));
        assertThat(cleared).isEqualTo(new PersonalProfile("Nuevo", actor.email()));
        assertThat(service.read(other).contactPhone()).isNull(); assertThat(service.read(cross).preferredLanguage()).isNull();
        assertThat(profiles.writes).isEqualTo(3);
    }
    private final Profiles profiles = new Profiles();
    private final Flags flags = new Flags();
    private final OwnProfileService service = new OwnProfileService(profiles, flags);
    private final AuthenticatedPrincipal a = account("tenant-a", UserRole.ADMIN);
    private final AuthenticatedPrincipal b = account("tenant-a", UserRole.STAFF);
    private final AuthenticatedPrincipal c = account("tenant-b", UserRole.MANAGER);

    @Test
    void readsAndUpdatesOnlyTheAuthenticatedAccount() {
        profiles.add(a, "A"); profiles.add(b, "B"); profiles.add(c, "C");
        assertThat(service.read(a)).isEqualTo(new PersonalProfile("A", a.email()));
        assertThat(service.updateFullName(a, "Nombre nuevo")).isEqualTo(new PersonalProfile("Nombre nuevo", a.email()));
        assertThat(service.read(a).fullName()).isEqualTo("Nombre nuevo");
        assertThat(service.read(b).fullName()).isEqualTo("B");
        assertThat(service.read(c).fullName()).isEqualTo("C");
        assertThat(profiles.writes).isEqualTo(1);
    }

    @Test
    void checksAccountBeforeFlagEvenWhenOff() {
        flags.enabled = false;
        assertFailure(() -> service.read(a), Reason.UNAUTHENTICATED);
        assertThat(flags.calls).isZero();
        assertThat(profiles.writes).isZero();
    }

    @Test
    void disabledFlagPreventsWritesAndIsEvaluatedForThePrincipalTenant() {
        profiles.add(a, "A"); flags.enabled = false;
        assertFailure(() -> service.updateFullName(a, "Otro nombre"), Reason.DISABLED);
        assertThat(flags.tenant).isEqualTo(a.tenantId());
        assertThat(flags.flag).isEqualTo(FeatureFlag.MAPIT_S6_MY_ACCOUNT);
        assertThat(profiles.writes).isZero();
    }

    @Test
    void flagProviderFailureDoesNotEnableTheFeature() {
        profiles.add(a, "A"); flags.unavailable = true;
        assertFailure(() -> service.read(a), Reason.DISABLED);
    }

    @Test
    void rollbackAndRecoveryKeepProfilesAndTenantIsolation() {
        profiles.add(a, "A"); profiles.add(b, "B"); profiles.add(c, "C");
        service.updateFullName(a, "Confirmado");
        flags.enabled = false;
        assertFailure(() -> service.read(a), Reason.DISABLED);
        assertFailure(() -> service.updateFullName(a, "No guardar"), Reason.DISABLED);
        flags.enabled = true;
        flags.unavailable = true;
        assertFailure(() -> service.updateFullName(a, "No guardar"), Reason.DISABLED);
        flags.unavailable = false;
        assertThat(service.read(a).fullName()).isEqualTo("Confirmado");
        assertThat(service.read(b).fullName()).isEqualTo("B");
        assertThat(service.read(c).fullName()).isEqualTo("C");
        assertThat(profiles.writes).isEqualTo(1);
    }

    @Test
    void sameUserIdInDifferentTenantAndObsoleteRoleDoNotResolve() {
        profiles.add(a, "A");
        var otherTenant = new AuthenticatedPrincipal(a.id(), c.tenantId(), a.email(), a.role());
        var otherRole = new AuthenticatedPrincipal(a.id(), a.tenantId(), a.email(), UserRole.STAFF);
        assertFailure(() -> service.read(otherTenant), Reason.UNAUTHENTICATED);
        assertFailure(() -> service.updateFullName(otherRole, "Intruso"), Reason.UNAUTHENTICATED);
        assertThat(profiles.writes).isZero();
    }

    @Test
    void superAdminUsesOnlyItsPlatformAccount() {
        var admin = account("platform", UserRole.SUPER_ADMIN);
        profiles.add(admin, "Plataforma");
        assertThat(service.updateFullName(admin, "Mi nombre").fullName()).isEqualTo("Mi nombre");
        assertThat(flags.tenant).isEqualTo(TenantId.of("platform"));
        assertFailure(() -> service.read(account("tenant-a", UserRole.SUPER_ADMIN)), Reason.FORBIDDEN);
        assertFailure(() -> service.read(account("platform", UserRole.ADMIN)), Reason.FORBIDDEN);
    }

    @ParameterizedTest
    @MethodSource("invalidNames")
    void rejectsInvalidNamesWithoutWriting(String value) {
        profiles.add(a, "A");
        assertFailure(() -> service.updateFullName(a, value), Reason.INVALID_REQUEST);
        assertThat(profiles.writes).isZero();
    }

    static Stream<String> invalidNames() {
        return Stream.of("", " ", " al inicio", "al final ", "dos\nlineas", "dos\rlineas", "\u00a0nombre", "x".repeat(121));
    }

    @Test
    void rejectsNullNameAndConcurrentLossOfEligibility() {
        profiles.add(a, "A");
        assertFailure(() -> service.updateFullName(a, null), Reason.INVALID_REQUEST);
        profiles.conflict = true;
        assertFailure(() -> service.updateFullName(a, "Nombre"), Reason.CONFLICT);
        assertThat(profiles.values.get(key(a)).fullName()).isEqualTo("A");
    }

    private static void assertFailure(Runnable action, Reason reason) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(OwnProfileFailure.class,
                failure -> assertThat(failure.reason()).isEqualTo(reason));
    }

    private static AuthenticatedPrincipal account(String tenant, UserRole role) {
        var id = UUID.randomUUID();
        return new AuthenticatedPrincipal(id, TenantId.of(tenant), id + "@example.test", role);
    }

    private static String key(AuthenticatedPrincipal actor) {
        return actor.tenantId().value() + ":" + actor.id() + ":" + actor.role();
    }

    /** Doble de prueba; producción solo usará JDBC/RLS real. */
    private static class Profiles implements PersonalProfileRepository {
        final Map<String, PersonalProfile> values = new HashMap<>();
        int writes;
        boolean conflict;
        void add(AuthenticatedPrincipal actor, String name) { values.put(key(actor), new PersonalProfile(name, actor.email())); }
        @Override public Optional<PersonalProfile> findOwn(AuthenticatedPrincipal actor) { return Optional.ofNullable(values.get(key(actor))); }
        @Override public Optional<PersonalProfile> updateOwn(AuthenticatedPrincipal actor, PersonalProfileChanges changes) {
            if (conflict) return Optional.empty();
            writes++;
            return Optional.of(values.computeIfPresent(key(actor), (id, old) -> new PersonalProfile(java.util.Objects.requireNonNull(changes.fullName().applyTo(old.fullName())), old.email(), changes.contactPhone().applyTo(old.contactPhone()), changes.preferredLanguage().applyTo(old.preferredLanguage()))));
        }
    }

    private static class Flags implements FeatureFlagPort {
        boolean enabled = true;
        boolean unavailable;
        int calls;
        TenantId tenant;
        FeatureFlag flag;
        @Override public boolean isEnabled(FeatureFlag value) { return enabled; }
        @Override public boolean isEnabled(FeatureFlag value, boolean fallback) { return enabled; }
        @Override public boolean isEnabledFor(FeatureFlag value, TenantId id) {
            calls++; tenant = id; flag = value;
            if (unavailable) throw new IllegalStateException("provider failure");
            return enabled;
        }
    }
}
