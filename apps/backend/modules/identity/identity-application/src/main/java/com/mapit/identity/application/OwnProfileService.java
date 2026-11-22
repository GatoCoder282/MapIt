package com.mapit.identity.application;

import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.application.OwnProfileFailure.Reason;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileChanges.Field;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Consulta/edición propias, sin administrar usuarios ni modificar autenticación global. */
@Service
public class OwnProfileService {
    private static final Pattern NAME = Pattern.compile("^\\S(?:[^\\r\\n]*\\S)?$", Pattern.UNICODE_CHARACTER_CLASS);
    private final PersonalProfileRepository profiles;
    private final FeatureFlagPort flags;

    public OwnProfileService(PersonalProfileRepository profiles, FeatureFlagPort flags) {
        this.profiles = profiles;
        this.flags = flags;
    }

    @Transactional(readOnly = true)
    public PersonalProfile read(AuthenticatedPrincipal actor) {
        return authorize(actor);
    }

    @Transactional
    public PersonalProfile updateFullName(AuthenticatedPrincipal actor, @Nullable String fullName) {
        return update(actor, new OwnProfilePatch(Field.provided(fullName),
                Field.absent(), Field.absent()));
    }

    @Transactional
    public PersonalProfile update(AuthenticatedPrincipal actor, OwnProfilePatch patch) {
        authorize(actor);
        return profiles.updateOwn(actor, java.util.Objects.requireNonNull(patch).changes())
                .orElseThrow(() -> new OwnProfileFailure(Reason.CONFLICT));
    }

    public static void validateFullName(@Nullable String name) {
        if (name == null || name.codePointCount(0, name.length()) > 120 || !NAME.matcher(name).matches()) {
            throw new OwnProfileFailure(Reason.INVALID_REQUEST);
        }
    }

    private PersonalProfile authorize(AuthenticatedPrincipal actor) {
        // platform no se usa como tenant destino de un miembro de negocio.
        if ((actor.role() == UserRole.SUPER_ADMIN) != "platform".equals(actor.tenantId().value())) {
            throw new OwnProfileFailure(Reason.FORBIDDEN);
        }
        // Elegibilidad de ESTA fila; no reemplaza ni copia CurrentStaffIdentity de MAP-238.
        var profile = profiles.findOwn(actor)
                .orElseThrow(() -> new OwnProfileFailure(Reason.UNAUTHENTICATED));
        boolean enabled;
        try {
            enabled = flags.isEnabledFor(FeatureFlag.MAPIT_S6_MY_ACCOUNT, actor.tenantId());
        } catch (RuntimeException unavailable) {
            enabled = false;
        }
        if (!enabled) throw new OwnProfileFailure(Reason.DISABLED);
        return profile;
    }
}
