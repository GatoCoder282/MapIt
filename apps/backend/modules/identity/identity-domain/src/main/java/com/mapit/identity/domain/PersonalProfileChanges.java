package com.mapit.identity.domain;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/** Campos validados por aplicación; presencia explícita permite un único UPDATE sin lecturas obsoletas. */
public record PersonalProfileChanges(Field<String> fullName, Field<String> contactPhone, Field<String> preferredLanguage) {
    public PersonalProfileChanges {
        Objects.requireNonNull(fullName); Objects.requireNonNull(contactPhone); Objects.requireNonNull(preferredLanguage);
        if (!fullName.present() && !contactPhone.present() && !preferredLanguage.present()) throw new IllegalArgumentException("Cambios vacíos");
        if (fullName.present() && fullName.value() == null) throw new IllegalArgumentException("Nombre obligatorio");
    }
    public static PersonalProfileChanges name(String value) {
        return new PersonalProfileChanges(Field.provided(Objects.requireNonNull(value)), Field.absent(), Field.absent());
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
