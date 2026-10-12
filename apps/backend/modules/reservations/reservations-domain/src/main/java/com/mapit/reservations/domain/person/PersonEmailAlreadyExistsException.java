package com.mapit.reservations.domain.person;

/** Conflicto al intentar registrar dos clientes activos con el mismo correo en un tenant. */
public final class PersonEmailAlreadyExistsException extends RuntimeException {

  public PersonEmailAlreadyExistsException(String email) {
    super("Ya existe un cliente activo con el correo " + email);
  }
}
