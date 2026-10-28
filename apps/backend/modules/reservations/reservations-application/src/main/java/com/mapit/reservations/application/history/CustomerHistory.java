package com.mapit.reservations.application.history;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.history.CustomerHistoryAccessRepository;
import com.mapit.reservations.domain.history.CustomerHistoryReservation;
import com.mapit.reservations.domain.history.CustomerHistoryReservationRepository;
import com.mapit.reservations.domain.person.PersonRepository;

@Service
public class CustomerHistory {
  private final CustomerHistoryAccessRepository access;
  private final CustomerHistoryReservationRepository reservations;
  private final PersonRepository people;
  private final HistorySecrets secrets;
  private final Clock clock;

  public CustomerHistory(CustomerHistoryAccessRepository access,
      CustomerHistoryReservationRepository reservations, PersonRepository people,
      HistorySecrets secrets, Clock clock) {
    this.access = access;
    this.reservations = reservations;
    this.people = people;
    this.secrets = secrets;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Page list(String slug, @Nullable String credential, @Nullable String authorization,
      String period, int limit, int offset, @Nullable Instant asOf) {
    requireCredential(credential, authorization);
    if (!period.equals("upcoming") && !period.equals("past") || limit < 1 || limit > 50 || offset < 0) {
      throw new IllegalArgumentException("Paginación o periodo inválido");
    }
    Instant now = clock.instant();
    var tenant = access.activeTenant(slug).orElseThrow(InvalidHistoryCredentialException::new);
    var person = access.validSession(tenant, secrets.hash(credential), now)
        .orElseThrow(InvalidHistoryCredentialException::new);
    people.findAliveById(tenant, person).orElseThrow(InvalidHistoryCredentialException::new);
    Instant boundary = asOf == null ? now : asOf;
    List<CustomerHistoryReservation> rows = reservations.findForPerson(tenant, person, boundary,
        period.equals("upcoming"), limit + 1, offset);
    return new Page(rows.stream().limit(limit).toList(), rows.size() > limit, boundary);
  }

  @Transactional
  public void revoke(String slug, @Nullable String credential, @Nullable String authorization) {
    requireCredential(credential, authorization);
    var tenant = access.activeTenant(slug).orElseThrow(InvalidHistoryCredentialException::new);
    Instant now = clock.instant();
    var person = access.validSession(tenant, secrets.hash(credential), now)
        .orElseThrow(InvalidHistoryCredentialException::new);
    people.findAliveById(tenant, person).orElseThrow(InvalidHistoryCredentialException::new);
    if (!access.revoke(tenant, secrets.hash(credential), now)) throw new InvalidHistoryCredentialException();
  }

  private static void requireCredential(@Nullable String credential, @Nullable String authorization) {
    if (authorization != null || credential == null || !credential.matches("^[A-Za-z0-9_-]{43}$")) {
      throw new InvalidHistoryCredentialException();
    }
  }

  public record Page(List<CustomerHistoryReservation> items, boolean hasMore, Instant asOf) {}
}
