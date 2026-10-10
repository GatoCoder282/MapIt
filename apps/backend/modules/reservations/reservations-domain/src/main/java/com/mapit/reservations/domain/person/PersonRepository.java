package com.mapit.reservations.domain.person;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Puerto de persistencia para clientes, siempre limitado al tenant autenticado. */
public interface PersonRepository {

  List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery);

  Optional<Person> findAliveById(TenantId tenantId, UUID id);

  Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail);

  Person insert(Person person);
}
