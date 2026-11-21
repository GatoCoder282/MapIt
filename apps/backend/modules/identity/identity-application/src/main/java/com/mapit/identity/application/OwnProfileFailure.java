package com.mapit.identity.application;

/** Fallos personales sin IDs, SQL, credenciales ni datos aportados por el cliente. */
public final class OwnProfileFailure extends RuntimeException {
    public enum Reason {
        UNAUTHENTICATED, FORBIDDEN, DISABLED, INVALID_REQUEST, FIELDS_UNAVAILABLE, CONFLICT
    }

    private final Reason reason;

    public OwnProfileFailure(Reason reason) {
        super(switch (reason) {
            case UNAUTHENTICATED -> "La sesión no identifica una cuenta vigente.";
            case FORBIDDEN -> "La cuenta no puede acceder a este perfil.";
            case DISABLED -> "Mi cuenta está deshabilitada.";
            case INVALID_REQUEST -> "La solicitud contiene campos o valores no permitidos.";
            case FIELDS_UNAVAILABLE -> "Contacto e idioma requieren una migración pendiente; no se guardaron cambios.";
            case CONFLICT -> "La cuenta cambió durante la operación; no se guardaron cambios.";
        });
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
