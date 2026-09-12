package com.mapit.identity.domain;

/** Error uniforme para no revelar existencia o estado de usuarios y empresas. */
public final class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Credenciales inválidas.");
    }
}
