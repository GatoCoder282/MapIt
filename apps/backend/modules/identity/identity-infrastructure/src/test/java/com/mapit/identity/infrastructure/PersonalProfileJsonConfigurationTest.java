package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.identity.domain.PersonalProfile;

import tools.jackson.databind.json.JsonMapper;

class PersonalProfileJsonConfigurationTest {
    private final JsonMapper mapper = JsonMapper.builder()
            .changeDefaultPropertyInclusion(value -> value.withValueInclusion(JsonInclude.Include.NON_NULL))
            .addModule(new PersonalProfileJsonConfiguration().personalProfileJsonModule()).build();

    @Test
    void explicitNullsSurviveTheApplicationNonNullDefaultWithoutExposingOtherFields() {
        var json = mapper.readTree(mapper.writeValueAsString(new PersonalProfile("Cuenta", "self@example.test")));
        assertThat(json.size()).isEqualTo(4);
        assertThat(json.has("contactPhone")).isTrue(); assertThat(json.get("contactPhone").isNull()).isTrue();
        assertThat(json.has("preferredLanguage")).isTrue(); assertThat(json.get("preferredLanguage").isNull()).isTrue();
    }

    @Test
    void persistedValuesArePreservedAndTheGlobalPolicyRemainsUnchangedForOtherTypes() {
        var profile = new PersonalProfile("Cuenta", "self@example.test", "123", "ja-JP");
        var json = mapper.readTree(mapper.writeValueAsString(profile));
        assertThat(json.get("contactPhone").asString()).isEqualTo("123");
        assertThat(json.get("preferredLanguage").asString()).isEqualTo("ja-JP");
        assertThat(mapper.writeValueAsString(new OtherResponse(null))).isEqualTo("{}");
    }

    record OtherResponse(@Nullable String value) {}
}
