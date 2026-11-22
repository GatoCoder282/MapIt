package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.mapit.identity.domain.PersonalProfileChanges.Field;


class OwnProfilePatchTest {
    @Test
    void absentKeepsPreviousValuesAndDoesNotRequestPendingPersistence() {
        var patch = new OwnProfilePatch(Field.provided("Nombre"), Field.absent(), Field.absent());
        assertThat(patch.fullName().applyTo("Anterior")).isEqualTo("Nombre");
        assertThat(patch.contactPhone().present()).isFalse();
        assertThat(patch.contactPhone().applyTo("+591 123")).isEqualTo("+591 123");
        assertThat(patch.preferredLanguage().applyTo("en")).isEqualTo("en");
        assertThat(patch.contactPhone().applyTo(null)).isNull();

    }

    @Test
    void explicitNullClearsOnlyOptionalFieldsAndKeepsAbsentName() {
        var patch = new OwnProfilePatch(Field.absent(), Field.provided(null), Field.provided(null));
        assertThat(patch.fullName().applyTo("Anterior")).isEqualTo("Anterior");
        assertThat(patch.contactPhone().present()).isTrue();
        assertThat(patch.preferredLanguage().present()).isTrue();
        assertThat(patch.contactPhone().applyTo("123")).isNull();
        assertThat(patch.preferredLanguage().applyTo("en")).isNull();

        invalid(() -> new OwnProfilePatch(Field.provided(null), Field.absent(), Field.absent()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "+591 (2) 123-45.6/7", " 1 "})
    void acceptsContractedPhoneWithoutNormalization(String phone) {
        var patch = new OwnProfilePatch(Field.absent(), Field.provided(phone), Field.absent());
        assertThat(patch.contactPhone().applyTo("Anterior")).isEqualTo(phone);

    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "+()-./", "abc123", "１２３", "123\n", "123\r", "1\t2"})
    void rejectsPhonesOutsideContract(String phone) {
        invalid(() -> new OwnProfilePatch(Field.absent(), Field.provided(phone), Field.absent()));
    }

    @Test
    void acceptsThirtyTwoPhoneCharactersAndRejectsThirtyThree() {
        String boundary = "1".repeat(32);
        assertThat(new OwnProfilePatch(Field.absent(), Field.provided(boundary), Field.absent())
                .contactPhone().value()).isEqualTo(boundary);
        invalid(() -> new OwnProfilePatch(Field.absent(), Field.provided(boundary + "1"), Field.absent()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"es", "en", "ja-JP"})
    void acceptsSupportedLanguageCodes(String language) {
        var patch = new OwnProfilePatch(Field.absent(), Field.absent(), Field.provided(language));
        assertThat(patch.preferredLanguage().value()).isEqualTo(language);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "ES", "es-BO", "en-US", "ja", "ja-jp", "fr", " en "})
    void rejectsUnsupportedOrNormalizedLanguageVariants(String language) {
        invalid(() -> new OwnProfilePatch(Field.absent(), Field.absent(), Field.provided(language)));
    }

    @Test
    void rejectsEmptyPatchAndInvalidNameEvenAlongsideValidPendingFields() {
        invalid(() -> new OwnProfilePatch(Field.absent(), Field.absent(), Field.absent()));
        invalid(() -> new OwnProfilePatch(Field.provided(" Nombre"), Field.provided("123"), Field.provided("es")));
        invalid(() -> new OwnProfilePatch(Field.provided("Nombre"), Field.provided("123"), Field.provided("fr")));
        assertThatThrownBy(() -> new Field<>(false, "valor")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void representationsDoNotExposePersonalValues() {
        var patch = new OwnProfilePatch(Field.provided("Nombre privado"), Field.provided("123"), Field.provided("es"));
        assertThat(patch.toString()).isEqualTo("OwnProfilePatch[REDACTED]");
        assertThat(patch.contactPhone().toString()).doesNotContain("123");
    }

    private static void invalid(Runnable operation) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(OwnProfileFailure.class,
                failure -> assertThat(failure.reason()).isEqualTo(OwnProfileFailure.Reason.INVALID_REQUEST));
    }
}
