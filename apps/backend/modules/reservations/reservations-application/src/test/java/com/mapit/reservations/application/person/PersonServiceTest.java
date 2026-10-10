package com.mapit.reservations.application.person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonEmailAlreadyExistsException;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class PersonServiceTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ACTOR = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

  private InMemoryPersonRepository repository;
  private PersonService service;

  @BeforeEach
  void setUp() {
    repository = new InMemoryPersonRepository();
    TenantContext tenantContext = () -> Optional.of(TENANT);
    ActorContext actorContext = () -> Optional.of(ACTOR);
    service =
        new PersonService(
            repository, tenantContext, actorContext, Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  void registraPersonaConTenantYActorDelContexto() {
    Person person = service.create("  Ana Pérez ", " ANA@EXAMPLE.COM ", "+591 70000000");

    assertThat(person.tenantId()).isEqualTo(TENANT);
    assertThat(person.email()).isEqualTo("ana@example.com");
    assertThat(person.createdBy()).isEqualTo(ACTOR);
    assertThat(person.createdAt()).isEqualTo(NOW);
    assertThat(repository.people).containsExactly(person);
  }

  @Test
  void rechazaCorreoDuplicadoDentroDelTenant() {
    service.create("Ana Pérez", "ana@example.com", null);

    assertThatThrownBy(() -> service.create("Otra Ana", " ANA@example.com ", null))
        .isInstanceOf(PersonEmailAlreadyExistsException.class);
    assertThat(repository.people).hasSize(1);
  }

  @Test
  void normalizaElTextoDeBusqueda() {
    service.search("  ANA   PÉREZ ");

    assertThat(repository.lastQuery).isEqualTo("ana pérez");
    assertThat(repository.lastTenant).isEqualTo(TENANT);
  }

  private static final class InMemoryPersonRepository implements PersonRepository {
    private final List<Person> people = new ArrayList<>();
    private @Nullable String lastQuery;
    private @Nullable TenantId lastTenant;

    @Override
    public List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery) {
      lastTenant = tenantId;
      lastQuery = normalizedQuery;
      return List.copyOf(people);
    }

    @Override
    public Optional<Person> findAliveById(TenantId tenantId, UUID id) {
      return people.stream()
          .filter(person -> person.tenantId().equals(tenantId))
          .filter(person -> person.id().value().equals(id))
          .findFirst();
    }

    @Override
    public Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail) {
      return people.stream()
          .filter(person -> person.tenantId().equals(tenantId))
          .filter(person -> normalizedEmail.equals(person.email()))
          .findFirst();
    }

    @Override
    public Person insert(Person person) {
      people.add(person);
      return person;
    }
  }
}
