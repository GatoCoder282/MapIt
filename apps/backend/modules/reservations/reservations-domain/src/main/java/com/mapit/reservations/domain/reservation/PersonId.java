package com.mapit.reservations.domain.reservation;

import java.util.Objects;
import java.util.UUID;

/** Identificador de la persona a la que pertenece la reserva. */
public record PersonId(UUID value) {

  public PersonId {
    Objects.requireNonNull(value, "personId no puede ser null");
  }

  public static PersonId of(UUID value) {
    return new PersonId(value);
  }

  public static PersonId generate() {
    return new PersonId(UUID.randomUUID());
  }

  @Override
  public String toString() {
    return value.toString();
  }
}
