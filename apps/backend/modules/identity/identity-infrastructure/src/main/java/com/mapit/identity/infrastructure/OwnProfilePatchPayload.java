package com.mapit.identity.infrastructure;

import java.util.Map;
import java.util.Set;

import org.jspecify.annotations.Nullable;

import com.mapit.identity.application.OwnProfileFailure;
import com.mapit.identity.application.OwnProfilePatch;
import com.mapit.identity.application.OwnProfilePatch.Field;

/** Frontera del JSON: claves cerradas y presencia explícita, sin convertir tipos del cliente. */
public final class OwnProfilePatchPayload {
    private static final Set<String> FIELDS = Set.of("fullName", "contactPhone", "preferredLanguage");

    private OwnProfilePatchPayload() {}

    public static OwnProfilePatch read(Map<String, @Nullable Object> body) {
        if (body.isEmpty() || !FIELDS.containsAll(body.keySet())) invalid();
        return new OwnProfilePatch(field(body, "fullName"), field(body, "contactPhone"), field(body, "preferredLanguage"));
    }

    private static Field<String> field(Map<String, @Nullable Object> body, String name) {
        if (!body.containsKey(name)) return Field.absent();
        Object value = body.get(name);
        if (value != null && !(value instanceof String)) invalid();
        return Field.provided((String) value);
    }

    private static void invalid() {
        throw new OwnProfileFailure(OwnProfileFailure.Reason.INVALID_REQUEST);
    }
}
