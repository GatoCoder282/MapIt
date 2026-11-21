package com.mapit.identity.domain;

import java.util.Objects;

/** Proyección de los campos personales que ya tienen persistencia en app_user. */
public record PersonalProfile(String fullName, String email) {
    public PersonalProfile {
        Objects.requireNonNull(fullName);
        Objects.requireNonNull(email);
    }
}
