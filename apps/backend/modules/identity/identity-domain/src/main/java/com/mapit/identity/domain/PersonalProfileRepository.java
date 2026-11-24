package com.mapit.identity.domain;

import java.util.Optional;

/** Acceso propio: tenant, usuario y rol siempre proceden del principal validado. */
public interface PersonalProfileRepository {
    /** Solo cuenta activa, tenant activo y rol persistido coincidente. */
    Optional<PersonalProfile> findOwn(AuthenticatedPrincipal actor);

    /** Un UPDATE de los campos presentes; ausentes conservados por SQL, null explícito limpia. */
    Optional<PersonalProfile> updateOwn(AuthenticatedPrincipal actor, PersonalProfileChanges changes);
}
