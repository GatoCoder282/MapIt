package com.mapit.reservations.application.person;

import java.time.Clock;
import java.util.List;
import java.util.Locale;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonEmailAlreadyExistsException;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Casos de uso de clientes para el flujo interno de reservas. */
@Service
public class PersonService {

  private final PersonRepository repository;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public PersonService(
      PersonRepository repository,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.repository = repository;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<Person> search(@Nullable String query) {
    return repository.searchAlive(tenantContext.require(), normalizeQuery(query));
  }

  @Transactional
  public Person create(
      String fullName, @Nullable String email, @Nullable String phone) {
    TenantId tenantId = tenantContext.require();
    Person person =
        Person.register(
            PersonId.generate(),
            tenantId,
            fullName,
            email,
            phone,
            clock.instant(),
            actorContext.requireUserId());

    if (person.email() != null
        && repository.findAliveByEmail(tenantId, person.email()).isPresent()) {
      throw new PersonEmailAlreadyExistsException(person.email());
    }
    return repository.insert(person);
  }

  private static @Nullable String normalizeQuery(@Nullable String query) {
    if (query == null) {
      return null;
    }
    String normalized = query.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    return normalized.isEmpty() ? null : normalized;
  }
}
