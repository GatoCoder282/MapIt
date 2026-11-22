package com.mapit.identity.application;

import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import com.mapit.identity.domain.PersonalProfileChanges;
import com.mapit.identity.domain.PersonalProfileChanges.Field;


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

    public PersonalProfileChanges changes() {
        return new PersonalProfileChanges(fullName, contactPhone, preferredLanguage);
    }
    @Override public String toString() { return "OwnProfilePatch[REDACTED]"; }
    private static void invalid() { throw new OwnProfileFailure(OwnProfileFailure.Reason.INVALID_REQUEST); }
}
