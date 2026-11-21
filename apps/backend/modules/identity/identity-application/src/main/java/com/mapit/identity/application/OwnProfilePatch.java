package com.mapit.identity.application;

import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

/** Comando completo validado, sin identidad ni autoridad editables. No implica persistencia. */
public record OwnProfilePatch(
        Field<String> fullName, Field<String> contactPhone, Field<String> preferredLanguage) {
    private static final Pattern PHONE = Pattern.compile("^[+0-9() ./-]*[0-9][+0-9() ./-]*$");
    private static final Set<String> LANGUAGES = Set.of("es", "en", "ja-JP");

    public OwnProfilePatch {
        Objects.requireNonNull(fullName);
        Objects.requireNonNull(contactPhone);
        Objects.requireNonNull(preferredLanguage);
        if (!fullName.present() && !contactPhone.present() && !preferredLanguage.present()) invalid();
        if (fullName.present()) OwnProfileService.validateFullName(fullName.value());
        String phone = contactPhone.value();
        if (phone != null && (phone.isEmpty() || phone.length() > 32 || !PHONE.matcher(phone).matches())) invalid();
        String language = preferredLanguage.value();
        if (language != null && !LANGUAGES.contains(language)) invalid();
    }

    /** Guard temporal: no escribir ni siquiera nombre si también llega un campo no persistible. */
    public boolean requiresPendingPersistence() {
        return contactPhone.present() || preferredLanguage.present();
    }

    @Override
    public String toString() {
        return "OwnProfilePatch[REDACTED]";
    }

    private static void invalid() {
        throw new OwnProfileFailure(OwnProfileFailure.Reason.INVALID_REQUEST);
    }

    /** Ausente conserva; presente/null limpia. La futura escritura debe usar present, no fusionar filas antiguas. */
    public record Field<T>(boolean present, @Nullable T value) {
        public Field {
            if (!present && value != null) throw new IllegalArgumentException("Un campo ausente no tiene valor.");
        }

        public static <T> Field<T> absent() {
            return new Field<>(false, null);
        }

        public static <T> Field<T> provided(@Nullable T value) {
            return new Field<>(true, value);
        }

        public @Nullable T applyTo(@Nullable T previous) {
            return present ? value : previous;
        }

        @Override
        public String toString() {
            return "Field[present=" + present + ", REDACTED]";
        }
    }
}
