package com.mapit.identity.domain;

import java.util.Optional;

/** Acceso propio: tenant, usuario y rol siempre proceden del principal validado. */
public interface PersonalProfileRepository {
    /** Solo cuenta activa, tenant activo y rol persistido coincidente. */
    Optional<PersonalProfile> findOwn(AuthenticatedPrincipal actor);

    /** Solo modifica full_name de la misma cuenta elegible; devuelve el valor persistido. */
    Optional<PersonalProfile> updateOwnFullName(AuthenticatedPrincipal actor, String fullName);
}
