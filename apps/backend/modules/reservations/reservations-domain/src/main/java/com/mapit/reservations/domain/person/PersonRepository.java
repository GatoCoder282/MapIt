package com.mapit.reservations.domain.person;

import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Puerto de persistencia para clientes, siempre limitado al tenant autenticado. */
public interface PersonRepository {

  List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery);

  Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail);

  Person insert(Person person);
}
