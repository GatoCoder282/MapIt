package com.mapit.reservations.domain.person;

import java.util.Objects;
import java.util.UUID;

/** Identificador opaco de una persona del tenant. */
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
