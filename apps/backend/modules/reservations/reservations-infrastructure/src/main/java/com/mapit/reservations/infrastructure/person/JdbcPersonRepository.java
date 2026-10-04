package com.mapit.reservations.infrastructure.person;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonEmailAlreadyExistsException;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Persistencia JDBC de clientes con filtro explícito y RLS por tenant. */
@Repository
public class JdbcPersonRepository implements PersonRepository {

  private static final int SEARCH_LIMIT = 20;

  private final JdbcTemplate jdbc;

  public JdbcPersonRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public List<Person> searchAlive(TenantId tenantId, @Nullable String normalizedQuery) {
    setTenant(tenantId);
    if (normalizedQuery == null) {
      return jdbc.query(
          """
          select * from person
          where tenant_id = ? and deleted_at is null
          order by full_name, id
          limit ?
          """,
          JdbcPersonRepository::map,
          tenantId.value(),
          SEARCH_LIMIT);
    }
    return jdbc.query(
        """
        select * from person
        where tenant_id = ? and deleted_at is null
          and (
            position(? in lower(full_name)) > 0
            or position(? in coalesce(email, '')) > 0
            or position(? in lower(coalesce(phone, ''))) > 0
          )
        order by full_name, id
        limit ?
        """,
        JdbcPersonRepository::map,
        tenantId.value(),
        normalizedQuery,
        normalizedQuery,
        normalizedQuery,
        SEARCH_LIMIT);
  }

  @Override
  public Optional<Person> findAliveByEmail(TenantId tenantId, String normalizedEmail) {
    setTenant(tenantId);
    return jdbc
        .query(
            """
            select * from person
            where tenant_id = ? and email = ? and deleted_at is null
            """,
            JdbcPersonRepository::map,
            tenantId.value(),
            normalizedEmail)
        .stream()
        .findFirst();
  }

  @Override
  public Person insert(Person person) {
    setTenant(person.tenantId());
    try {
      return jdbc
          .query(
              """
              insert into person (
                id, tenant_id, full_name, email, phone,
                created_at, created_by, updated_at, updated_by
              ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
              returning *
              """,
              JdbcPersonRepository::map,
              person.id().value(),
              person.tenantId().value(),
              person.fullName(),
              person.email(),
              person.phone(),
              Timestamp.from(person.createdAt()),
              person.createdBy(),
              Timestamp.from(person.updatedAt()),
              person.updatedBy())
          .getFirst();
    } catch (DataIntegrityViolationException exception) {
      if (person.email() != null && isEmailConflict(exception)) {
        throw new PersonEmailAlreadyExistsException(person.email());
      }
      throw exception;
    }
  }

  private static boolean isEmailConflict(DataIntegrityViolationException exception) {
    Throwable cause = exception;
    while (cause != null) {
      if (cause.getMessage() != null
          && cause.getMessage().contains("person_tenant_email_live_uidx")) {
        return true;
      }
      cause = cause.getCause();
    }
    return false;
  }

  private static Person map(ResultSet result, int rowNumber) throws SQLException {
    Timestamp deletedAt = result.getTimestamp("deleted_at");
    return new Person(
        PersonId.of(result.getObject("id", java.util.UUID.class)),
        TenantId.of(result.getString("tenant_id")),
        result.getString("full_name"),
        result.getString("email"),
        result.getString("phone"),
        result.getTimestamp("created_at").toInstant(),
        result.getObject("created_by", java.util.UUID.class),
        result.getTimestamp("updated_at").toInstant(),
        result.getObject("updated_by", java.util.UUID.class),
        deletedAt == null ? null : deletedAt.toInstant(),
        result.getObject("deleted_by", java.util.UUID.class));
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
