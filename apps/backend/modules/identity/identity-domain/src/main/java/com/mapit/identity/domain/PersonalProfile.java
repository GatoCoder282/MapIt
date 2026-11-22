package com.mapit.identity.domain;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/** Proyección de los campos personales que ya tienen persistencia en app_user. */
public record PersonalProfile(String fullName, String email, @Nullable String contactPhone, @Nullable String preferredLanguage) {
    public PersonalProfile(String fullName, String email) { this(fullName, email, null, null); }
    public PersonalProfile {
        Objects.requireNonNull(fullName);
        Objects.requireNonNull(email);
    }
}
