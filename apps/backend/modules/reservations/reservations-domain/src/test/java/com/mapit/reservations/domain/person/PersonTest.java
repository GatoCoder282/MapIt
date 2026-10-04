package com.mapit.reservations.domain.person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class PersonTest {

  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");

  @Test
  void normalizaLosDatosAlRegistrar() {
    Person person =
        Person.register(
            PersonId.generate(),
            TenantId.of("tenant-a"),
            "  Ana   Pérez  ",
            "  ANA@Example.COM ",
            "  +591 70000000  ",
            NOW,
            ACTOR);

    assertThat(person.fullName()).isEqualTo("Ana Pérez");
    assertThat(person.email()).isEqualTo("ana@example.com");
    assertThat(person.phone()).isEqualTo("+591 70000000");
    assertThat(person.createdAt()).isEqualTo(NOW);
    assertThat(person.updatedAt()).isEqualTo(NOW);
    assertThat(person.createdBy()).isEqualTo(ACTOR);
    assertThat(person.updatedBy()).isEqualTo(ACTOR);
  }

  @Test
  void convierteContactoVacioEnAusente() {
    Person person =
        Person.register(
            PersonId.generate(), TenantId.of("tenant-a"), "Ana Pérez", " ", " ", NOW, ACTOR);

    assertThat(person.email()).isNull();
    assertThat(person.phone()).isNull();
  }

  @Test
  void rechazaNombreVacio() {
    assertThatThrownBy(
            () ->
                Person.register(
                    PersonId.generate(), TenantId.of("tenant-a"), " ", null, null, NOW, ACTOR))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("El nombre es obligatorio");
  }

  @Test
  void rechazaCorreoInvalido() {
    assertThatThrownBy(
            () ->
                Person.register(
                    PersonId.generate(),
                    TenantId.of("tenant-a"),
                    "Ana Pérez",
                    "correo-invalido",
                    null,
                    NOW,
                    ACTOR))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("El correo no tiene un formato válido");
  }
}
