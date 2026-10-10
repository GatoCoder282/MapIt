package com.mapit.reservations.infrastructure.reservation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Bloquea los elementos en orden estable durante la transacción de creación. */
@Repository
public class JdbcReservationConcurrencyGuard implements ReservationConcurrencyGuard {

  private final JdbcTemplate jdbc;

  public JdbcReservationConcurrencyGuard(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void lockResources(TenantId tenantId, Set<UUID> elementIds) {
    if (elementIds.isEmpty()) {
      return;
    }
    setTenant(tenantId);
    List<UUID> orderedIds = elementIds.stream().sorted().toList();
    String placeholders = String.join(", ", Collections.nCopies(orderedIds.size(), "?"));
    String sql =
        """
        /* reservation-concurrency-guard */
        select id
        from space_element
        where tenant_id = ? and id in (%s)
        order by id
        for update
        """
            .formatted(placeholders);
    List<Object> arguments = new ArrayList<>();
    arguments.add(tenantId.value());
    arguments.addAll(orderedIds);
    jdbc.queryForList(sql, UUID.class, arguments.toArray());
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
