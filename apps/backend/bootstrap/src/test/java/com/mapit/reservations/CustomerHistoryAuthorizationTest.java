package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.reservations.application.history.CustomerHistory;
import com.mapit.reservations.application.history.HistorySecrets;
import com.mapit.reservations.application.history.InvalidHistoryCredentialException;
import com.mapit.reservations.domain.history.CustomerHistoryAccessRepository;
import com.mapit.reservations.domain.history.CustomerHistoryReservationRepository;
import com.mapit.reservations.domain.person.PersonRepository;
import com.mapit.shared.tenant.TenantId;

class CustomerHistoryAuthorizationTest {
  private final CustomerHistoryAccessRepository access = mock(CustomerHistoryAccessRepository.class);
  private final CustomerHistoryReservationRepository reservations = mock(CustomerHistoryReservationRepository.class);
  private final PersonRepository people = mock(PersonRepository.class);
  private final HistorySecrets secrets = new HistorySecrets();
  private final Instant now = Instant.parse("2026-10-25T12:00:00Z");
  private final CustomerHistory history = new CustomerHistory(access, reservations, people, secrets,
      Clock.fixed(now, ZoneOffset.UTC));

  @Test
  void ningunaCredencialInvalidaTocaElRepositorioDeReservas() {
    TenantId tenant = TenantId.of("history-a");
    String validShape = secrets.generate();
    when(access.activeTenant("history-a")).thenReturn(Optional.of(tenant));
    when(access.activeTenant("history-b")).thenReturn(Optional.of(TenantId.of("history-b")));
    when(access.validSession(tenant, secrets.hash(validShape), now)).thenReturn(Optional.empty());

    for (String[] attempt : new String[][] {
        {"history-a", null, null},
        {"history-a", "invalid", null},
        {"history-a", validShape, null},
        {"history-b", validShape, null},
        {"history-a", validShape, "Bearer staff.jwt.token"}
    }) {
      assertThatThrownBy(() -> history.list(attempt[0], attempt[1], attempt[2], "upcoming", 20, 0, null))
          .isInstanceOf(InvalidHistoryCredentialException.class);
    }
    verify(reservations, never()).findForPerson(
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(UUID.class),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyBoolean(),
        org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());
  }
}
