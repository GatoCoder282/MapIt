package com.mapit.reservations.domain.history;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

public interface CustomerHistoryReservationRepository {
  List<CustomerHistoryReservation> findForPerson(TenantId tenant, UUID person, Instant asOf,
      boolean upcoming, int limitPlusOne, int offset);
}
