package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.mapit.identity.application.OwnProfileFailure;

class OwnProfilePatchPayloadTest {
    @Test
    void preservesAbsenceNullAndValuesWithoutRetainingMutablePayload() {
        var body = new HashMap<String, Object>();
        body.put("contactPhone", null);
        body.put("preferredLanguage", "ja-JP");
        var patch = OwnProfilePatchPayload.read(body);
        body.put("contactPhone", "123");
        body.put("preferredLanguage", "en");
        assertThat(patch.fullName().present()).isFalse();
        assertThat(patch.contactPhone().present()).isTrue();
        assertThat(patch.contactPhone().value()).isNull();
        assertThat(patch.preferredLanguage().value()).isEqualTo("ja-JP");
    }

    @ParameterizedTest
    @ValueSource(strings = {"fullName", "contactPhone", "preferredLanguage"})
    void refusesNonStringValuesWithoutCoercion(String field) {
        for (Object value : new Object[] {123, true, java.util.List.of("es"), Map.of("value", "es")}) {
            assertThatThrownBy(() -> OwnProfilePatchPayload.read(Map.of(field, value)))
                    .isInstanceOf(OwnProfileFailure.class);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"email", "role", "roles", "tenantId", "tenantSlug", "userId", "memberships",
            "privileges", "permissions", "active", "status", "unknown"})
    void refusesPrivilegedOrUnknownFieldsEvenWithNull(String field) {
        var body = new HashMap<String, Object>();
        body.put("fullName", "Nombre");
        body.put(field, null);
        assertThatThrownBy(() -> OwnProfilePatchPayload.read(body)).isInstanceOf(OwnProfileFailure.class);
    }

    @Test
    void refusesEmptyPatchAndNullName() {
        assertThatThrownBy(() -> OwnProfilePatchPayload.read(Map.of())).isInstanceOf(OwnProfileFailure.class);
        var body = new HashMap<String, Object>();
        body.put("fullName", null);
        assertThatThrownBy(() -> OwnProfilePatchPayload.read(body)).isInstanceOf(OwnProfileFailure.class);
    }
}
